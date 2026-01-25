// =====================================================
// TIS TIS PLATFORM - LangGraph AI Service
// Servicio que integra LangGraph con el sistema existente
// =====================================================
// OPTIMIZACIÓN: Usa prompts pre-cacheados de ai_generated_prompts
// en lugar de reconstruir el contexto completo cada vez.
// Los prompts se generan UNA VEZ cuando el usuario guarda
// cambios en Business IA, reduciendo tokens de ~5000 a ~1500.
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
import type { ResponseStyleKey } from '@/src/shared/config/response-style-instructions';

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
// LEARNING INTEGRATION
// ======================

/**
 * Carga el contexto de aprendizaje del tenant para enriquecer los prompts
 * Incluye: patrones, vocabulario, objeciones, preferencias detectadas
 *
 * REVISIÓN 5.5: Integración AI Learning con Tool Calling + RAG
 */
async function loadLearningContext(tenantId: string): Promise<LearningContextData | null> {
  try {
    const learningContext = await MessageLearningService.getLearningContext(tenantId);

    if (!learningContext) {
      return null;
    }

    console.log(`[LangGraph AI] Learning context loaded: ${learningContext.topServiceRequests.length} service patterns, ${learningContext.learnedVocabulary.length} vocabulary terms`);

    return learningContext;
  } catch (err) {
    console.log('[LangGraph AI] Learning context not available (optional):', err instanceof Error ? err.message : 'Unknown error');
    return null;
  }
}

/**
 * Carga el contexto de lealtad del tenant y del lead
 * Incluye: programa, balance de tokens, membresía, recompensas disponibles
 *
 * REVISIÓN 5.5: Integración Loyalty con AI para consultas conversacionales
 */
async function loadLoyaltyContext(tenantId: string, leadId?: string): Promise<LoyaltyContextData | null> {
  const supabase = createServerClient();

  try {
    // 1. Cargar programa de lealtad del tenant
    const { data: program } = await supabase
      .from('loyalty_programs')
      .select(`
        id,
        program_name,
        is_active,
        tokens_enabled,
        tokens_name,
        tokens_per_currency,
        tokens_currency_threshold,
        membership_enabled
      `)
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .single();

    if (!program || !program.is_active) {
      return null;
    }

    // 2. Si tenemos leadId, cargar su estado de lealtad
    let leadStatus: LoyaltyContextData['lead_status'] = null;
    let availableRewards: LoyaltyContextData['available_rewards'] = [];

    if (leadId) {
      // Cargar balance y membresía del lead EN PARALELO
      // FIX v5.5.1: Tabla correcta es 'loyalty_balances', campos: current_balance, total_earned, total_spent
      const [balanceResult, membershipResult, rewardsResult] = await Promise.all([
        // Balance de tokens
        supabase
          .from('loyalty_balances')
          .select('current_balance, total_earned, total_spent')
          .eq('program_id', program.id)
          .eq('lead_id', leadId)
          .maybeSingle(),

        // Membresía activa
        supabase
          .from('loyalty_memberships')
          .select(`
            id,
            status,
            end_date,
            plan:loyalty_membership_plans(name, tier_level)
          `)
          .eq('program_id', program.id)
          .eq('lead_id', leadId)
          .eq('status', 'active')
          .maybeSingle(),

        // Recompensas disponibles (que el lead puede canjear)
        supabase
          .from('loyalty_rewards')
          .select('id, name, tokens_required, category')
          .eq('program_id', program.id)
          .eq('is_active', true)
          .order('tokens_required', { ascending: true })
          .limit(10),
      ]);

      const balance = balanceResult.data;
      const membership = membershipResult.data as {
        id: string;
        status: string;
        end_date: string | null;
        plan: { name: string; tier_level: string } | null;
      } | null;

      // FIX v5.5.1: Campo correcto es total_spent, no total_redeemed
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

    console.log(
      `[LangGraph AI] Loyalty context loaded: Program "${program.program_name}", ` +
      `Lead balance: ${leadStatus?.token_balance || 0} ${program.tokens_name}, ` +
      `Available rewards: ${availableRewards.length}`
    );

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
    console.log('[LangGraph AI] Loyalty context not available (optional):', err instanceof Error ? err.message : 'Unknown error');
    return null;
  }
}

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
 * Carga el contexto del tenant para el grafo
 *
 * OPTIMIZACIÓN: Usa el prompt pre-cacheado de ai_generated_prompts
 * en lugar de reconstruir el system_prompt desde los datos raw.
 * Esto reduce significativamente los tokens por request.
 *
 * ARQUITECTURA V6: Cuando useMinimalPrompt=true, genera un prompt
 * minimal (~1,200-1,500 tokens) en lugar del legacy (~4,000 tokens).
 * Los datos del negocio se obtienen via Tools dinámicamente.
 *
 * INTEGRACIÓN Agent Profiles: Aplica configuración del perfil activo
 * (response_style, custom_instructions_override, etc.)
 */
async function loadTenantContext(
  tenantId: string,
  channel: CacheChannel = 'whatsapp',
  profileType: ProfileType = 'business',
  useMinimalPrompt: boolean = false
): Promise<TenantInfo | null> {
  const supabase = createServerClient();

  // 1. Cargar datos básicos del tenant y Agent Profile EN PARALELO
  const [rpcResult, agentProfile] = await Promise.all([
    supabase.rpc('get_tenant_ai_context', { p_tenant_id: tenantId }),
    getProfileForAI(tenantId, profileType),
  ]);

  const { data, error } = rpcResult;

  if (error || !data) {
    console.error('[LangGraph AI] Error loading tenant context:', error);
    return null;
  }

  // Cast data.ai_config para evitar repetir el cast
  const aiConfig = data.ai_config as Record<string, unknown> | undefined;

  // 2. Determinar qué prompt usar
  let finalSystemPrompt: string;
  let promptSource: string;

  if (useMinimalPrompt) {
    // ARQUITECTURA V6: Usar prompt minimal CACHEADO
    // generateAndCacheMinimalPrompt verifica si ya existe un prompt válido en caché
    try {
      const minimalResult = await generateAndCacheMinimalPrompt(tenantId, channel);

      if (minimalResult.success) {
        finalSystemPrompt = minimalResult.prompt;
        promptSource = `minimal-v6-cached`;
        console.log(`[LangGraph AI] ARQUITECTURA V6: Using cached minimal prompt`);
      } else {
        // Fallback a generación directa si el caché falla
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
        promptSource = `minimal-v6-direct (~${directResult.tokenEstimate} tokens)`;
        console.log(`[LangGraph AI] ARQUITECTURA V6: Generated minimal prompt directly`);
      }
    } catch (minimalError) {
      console.error('[LangGraph AI] Error with minimal prompt, falling back to legacy:', minimalError);
      // Cargar prompt legacy como fallback de emergencia
      const legacyResult = await getOptimizedPrompt(tenantId, channel);
      finalSystemPrompt = legacyResult.prompt || (aiConfig?.system_prompt as string) || '';
      promptSource = 'legacy-fallback';
    }
  } else {
    // LEGACY: Usar prompt cacheado completo
    // Solo cargamos el prompt legacy cuando lo necesitamos (no en paralelo)
    const promptResult = await getOptimizedPrompt(tenantId, channel);
    const { prompt: cachedPrompt, fromCache, version } = promptResult;

    if (fromCache) {
      console.log(`[LangGraph AI] Using cached prompt v${version} for channel ${channel}`);
    } else if (cachedPrompt) {
      console.log(`[LangGraph AI] Using freshly generated prompt for channel ${channel}`);
    }

    finalSystemPrompt = cachedPrompt || (aiConfig?.system_prompt as string) || '';
    promptSource = fromCache ? `cached-v${version}` : 'fresh';
  }

  // 3. Aplicar configuración del Agent Profile si existe
  let responseStyle = (aiConfig?.response_style as string) || 'professional';

  if (agentProfile) {
    console.log(`[LangGraph AI] Using Agent Profile: ${agentProfile.profile?.profile_name || profileType}`);

    // Aplicar response_style del perfil
    responseStyle = agentProfile.response_style || responseStyle;

    // Si el perfil tiene custom_instructions_override, añadirlo al prompt
    // NOTA: En arquitectura v6, esto se añade al final del prompt minimal
    if (agentProfile.custom_instructions) {
      finalSystemPrompt = `${finalSystemPrompt}\n\n## INSTRUCCIONES ADICIONALES DEL PERFIL\n${agentProfile.custom_instructions}`;
    }

    // Logging para debugging
    if (agentProfile.delay_config.minutes > 0) {
      console.log(`[LangGraph AI] Profile has response delay: ${agentProfile.delay_config.minutes}min`);
    }
  }

  // Validar vertical
  const validVerticals = ['dental', 'restaurant', 'clinic', 'gym', 'beauty', 'veterinary'] as const;
  const rawVertical = data.vertical || 'dental';
  const vertical = validVerticals.includes(rawVertical as typeof validVerticals[number])
    ? rawVertical as typeof validVerticals[number]
    : 'dental';

  // Mapear al formato del estado
  return {
    tenant_id: data.tenant_id,
    tenant_name: data.tenant_name,
    vertical,
    timezone: data.timezone || 'America/Mexico_City',
    ai_config: {
      system_prompt: finalSystemPrompt,
      model: (aiConfig?.model as string) || 'gpt-5-mini',
      temperature: (aiConfig?.temperature as number) || 0.7,
      response_style: responseStyle as ResponseStyleKey,
      max_response_length: (aiConfig?.max_response_length as number) || 300,
      enable_scoring: (aiConfig?.enable_scoring as boolean) ?? true,
      auto_escalate_keywords: (aiConfig?.auto_escalate_keywords as string[]) || [],
      // Configuración de escalación (desde ai_tenant_config y agent_profiles)
      max_turns_before_escalation: (aiConfig?.max_turns_before_escalation as number) || 10,
      escalate_on_hot_lead: (aiConfig?.escalate_on_hot_lead as boolean) ?? true,
      business_hours: (aiConfig?.business_hours as { start: string; end: string; days: number[] }) || {
        start: '09:00',
        end: '18:00',
        days: [1, 2, 3, 4, 5],
      },
    },
    // Añadir datos del Agent Profile para uso posterior
    agent_profile: agentProfile ? {
      profile_id: agentProfile.profile?.id,
      profile_type: profileType,
      template_key: agentProfile.template_key,
      response_delay_minutes: agentProfile.delay_config.minutes,
      response_delay_first_only: agentProfile.delay_config.first_only,
      ai_learning_config: agentProfile.learning_config,
    } : undefined,
    // ARQUITECTURA V6: Indicar qué tipo de prompt se usó
    prompt_source: promptSource,
  };
}

/**
 * Carga el contexto del lead para el grafo
 * FIXED: Now filters out soft-deleted leads (H7 fix)
 */
async function loadLeadContext(leadId: string): Promise<LeadInfo | null> {
  const supabase = createServerClient();

  const { data: lead, error } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .is('deleted_at', null)  // H7 FIX: Only load active leads
    .single();

  if (error || !lead) {
    // Check if lead was soft-deleted
    if (error?.code === 'PGRST116') {
      console.warn(`[LangGraph AI] Lead ${leadId} not found or was deleted`);
    } else {
      console.error('[LangGraph AI] Error loading lead context:', error);
    }
    return null;
  }

  // Build name from available fields
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
 * Para restaurantes: También carga el menú completo con categorías
 *
 * SPRINT 3: Ahora incluye learning_context con patrones aprendidos
 * para mejorar la detección de intenciones en el supervisor
 */
async function loadBusinessContext(tenantId: string): Promise<BusinessContext | null> {
  const supabase = createServerClient();

  // Cargar contexto core y datos externos EN PARALELO
  // Si external_data falla, el AI sigue funcionando normalmente
  const loadExternalData = async () => {
    try {
      const result = await supabase.rpc('get_tenant_external_data', { p_tenant_id: tenantId });
      return result;
    } catch (err: unknown) {
      // Fallback silencioso - external_data es opcional
      const errorMessage = err instanceof Error ? err.message : 'RPC not found';
      console.log('[LangGraph AI] External data not available (optional):', errorMessage);
      return { data: null, error: null };
    }
  };

  // Cargar menú del restaurante (solo si es vertical restaurant)
  const loadRestaurantMenu = async () => {
    try {
      // Primero verificar si es restaurant
      const { data: tenant } = await supabase
        .from('tenants')
        .select('vertical')
        .eq('id', tenantId)
        .single();

      if (tenant?.vertical?.toLowerCase() !== 'restaurant') {
        return { categories: [], items: [] };
      }

      // Cargar categorías y items en paralelo
      const [categoriesResult, itemsResult] = await Promise.all([
        supabase
          .from('restaurant_menu_categories')
          .select('id, name, description, slug, display_order, is_active, parent_id')
          .eq('tenant_id', tenantId)
          .eq('is_active', true)
          .is('deleted_at', null)
          .order('display_order'),
        supabase
          .from('restaurant_menu_items')
          .select(`
            id,
            name,
            description,
            short_description,
            category_id,
            price,
            prep_time_minutes,
            is_available,
            is_vegetarian,
            is_vegan,
            is_gluten_free,
            is_spicy,
            spice_level,
            is_house_special,
            is_chef_recommendation,
            is_new,
            allergens,
            variants,
            sizes,
            add_ons,
            is_featured,
            times_ordered,
            average_rating
          `)
          .eq('tenant_id', tenantId)
          .eq('is_available', true)
          .is('deleted_at', null)
          .order('display_order'),
      ]);

      return {
        categories: categoriesResult.data || [],
        items: itemsResult.data || [],
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error loading menu';
      console.log('[LangGraph AI] Restaurant menu not available:', errorMessage);
      return { categories: [], items: [] };
    }
  };

  // SPRINT 3: Cargar learning context en paralelo para usar en supervisor
  const [coreResult, externalResult, menuResult, learningResult] = await Promise.all([
    supabase.rpc('get_tenant_ai_context', { p_tenant_id: tenantId }),
    loadExternalData(),
    loadRestaurantMenu(),
    loadLearningContext(tenantId), // SPRINT 3: Learning patterns para supervisor
  ]);

  const { data, error } = coreResult;
  const externalData = externalResult?.data;
  const menuData = menuResult;
  const learningData = learningResult;

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

    // =====================================================
    // MENÚ DE RESTAURANTE (Solo para vertical restaurant)
    // =====================================================
    menu_categories: menuData.categories.length > 0 ? menuData.categories.map((cat: Record<string, unknown>) => ({
      id: cat.id as string,
      name: cat.name as string,
      description: cat.description as string | undefined,
      display_order: (cat.display_order as number) || 0,
      is_active: (cat.is_active as boolean) ?? true,
    })) : undefined,

    menu_items: menuData.items.length > 0 ? menuData.items.map((item: Record<string, unknown>) => {
      // Encontrar el nombre de la categoría
      const category = menuData.categories.find((c: Record<string, unknown>) => c.id === item.category_id);

      // Mapear variants/sizes/add_ons a modifiers
      const modifiers: Array<{
        id: string;
        name: string;
        options: Array<{ id: string; name: string; price_adjustment: number }>;
        is_required: boolean;
        max_selections?: number;
      }> = [];

      // Agregar sizes como modifier si existen
      const sizes = item.sizes as Array<{ name: string; price: number }> | null;
      if (sizes && sizes.length > 0) {
        modifiers.push({
          id: 'size',
          name: 'Tamaño',
          options: sizes.map((s, idx) => ({
            id: `size_${idx}`,
            name: s.name,
            price_adjustment: s.price - (item.price as number),
          })),
          is_required: true,
          max_selections: 1,
        });
      }

      // Agregar add_ons como modifier si existen
      const addOns = item.add_ons as Array<{ name: string; price: number; max_qty?: number }> | null;
      if (addOns && addOns.length > 0) {
        modifiers.push({
          id: 'add_ons',
          name: 'Extras',
          options: addOns.map((a, idx) => ({
            id: `addon_${idx}`,
            name: a.name,
            price_adjustment: a.price,
          })),
          is_required: false,
        });
      }

      // Construir tags basados en flags
      const tags: string[] = [];
      if (item.is_vegetarian) tags.push('vegetariano');
      if (item.is_vegan) tags.push('vegano');
      if (item.is_gluten_free) tags.push('sin gluten');
      if (item.is_spicy) tags.push('picante');
      if (item.is_house_special) tags.push('especialidad de la casa');
      if (item.is_chef_recommendation) tags.push('recomendación del chef');
      if (item.is_new) tags.push('nuevo');

      return {
        id: item.id as string,
        name: item.name as string,
        description: (item.description as string) || (item.short_description as string) || undefined,
        ai_description: undefined, // Se puede agregar campo específico después
        category_id: item.category_id as string,
        category_name: (category?.name as string) || 'Sin categoría',
        base_price: item.price as number,
        is_available: (item.is_available as boolean) ?? true,
        preparation_time_minutes: item.prep_time_minutes as number | undefined,
        allergens: item.allergens as string[] | undefined,
        tags: tags.length > 0 ? tags : undefined,
        is_popular: (item.times_ordered as number) > 10 || (item.is_featured as boolean),
        modifiers: modifiers.length > 0 ? modifiers : undefined,
      };
    }) : undefined,

    // Configuración de pedidos - TODO: mover a tabla de configuración del tenant
    ordering_config: menuData.items.length > 0 ? {
      accepts_pickup: true,
      accepts_delivery: false, // Por ahora solo pickup
      accepts_dine_in: true,
      min_pickup_time_minutes: 20,
      min_delivery_time_minutes: 45,
      special_instructions_enabled: true,
    } : undefined,

    // =====================================================
    // DATOS EXTERNOS - De sistemas integrados (CRM, POS, etc.)
    // OPCIONAL: Solo presente si el tenant tiene integraciones activas
    // =====================================================
    external_data: externalData ? {
      has_integrations: externalData.has_integrations as boolean,
      source_systems: (externalData.source_systems as string[]) || [],
      low_stock_items: (externalData.low_stock_items as Array<{
        name: string;
        sku?: string;
        quantity: number;
        reorder_point?: number;
        category?: string;
      }>) || [],
      external_products: (externalData.external_products as Array<{
        name: string;
        price?: number;
        category?: string;
        is_available: boolean;
        preparation_time?: number;
      }>) || [],
      external_appointments_count: externalData.external_appointments_count as number | undefined,
      last_sync_at: externalData.last_sync_at as string | undefined,
    } : undefined,

    // =====================================================
    // SPRINT 3: AI LEARNING CONTEXT - Patrones aprendidos
    // Usado por el supervisor para mejorar routing y detección
    // =====================================================
    learning_context: learningData ? {
      topServiceRequests: learningData.topServiceRequests || [],
      commonObjections: learningData.commonObjections || [],
      schedulingPreferences: learningData.schedulingPreferences || [],
      painPoints: learningData.painPoints || [],
      learnedVocabulary: learningData.learnedVocabulary || [],
    } : undefined,
  };
}

// ======================
// ENRICHMENT BUILDERS
// ======================

/**
 * Construye el texto de enriquecimiento a partir del contexto de aprendizaje
 * Se inyecta en el system_prompt para mejorar las respuestas
 *
 * REVISIÓN 5.5: Feedback loop del AI Learning
 */
function buildLearningEnrichment(learningContext: LearningContextData): string {
  const sections: string[] = [];

  sections.push('## CONTEXTO APRENDIDO (de conversaciones previas)');

  // Servicios más solicitados
  if (learningContext.topServiceRequests.length > 0) {
    const services = learningContext.topServiceRequests
      .slice(0, 5)
      .map(s => `- "${s.service}" (${s.frequency} solicitudes)`)
      .join('\n');
    sections.push(`\n### Servicios más solicitados:\n${services}`);
  }

  // Objeciones comunes
  if (learningContext.commonObjections.length > 0) {
    const objections = learningContext.commonObjections
      .slice(0, 5)
      .map(o => `- "${o.objection}"`)
      .join('\n');
    sections.push(`\n### Objeciones comunes a manejar:\n${objections}`);
  }

  // Preferencias de horarios
  if (learningContext.schedulingPreferences.length > 0) {
    const preferences = learningContext.schedulingPreferences
      .slice(0, 5)
      .map(p => `- ${p.preference}`)
      .join('\n');
    sections.push(`\n### Preferencias de horarios detectadas:\n${preferences}`);
  }

  // Pain points
  if (learningContext.painPoints.length > 0) {
    const pains = learningContext.painPoints
      .slice(0, 5)
      .map(p => `- "${p.pain}"`)
      .join('\n');
    sections.push(`\n### Problemas/dolencias frecuentes:\n${pains}`);
  }

  // Vocabulario aprendido
  if (learningContext.learnedVocabulary.length > 0) {
    const vocab = learningContext.learnedVocabulary
      .slice(0, 10)
      .map(v => `- "${v.term}" = ${v.meaning} (${v.category})`)
      .join('\n');
    sections.push(`\n### Vocabulario específico del cliente:\n${vocab}`);
  }

  return sections.join('\n');
}

/**
 * Construye el texto de enriquecimiento a partir del contexto de lealtad
 * Permite al AI responder preguntas sobre puntos, membresías y recompensas
 *
 * REVISIÓN 5.5: Integración Loyalty con AI conversacional
 */
function buildLoyaltyEnrichment(loyaltyContext: LoyaltyContextData): string {
  if (!loyaltyContext.program) return '';

  const sections: string[] = [];
  const { program, lead_status, available_rewards } = loyaltyContext;

  sections.push('## PROGRAMA DE LEALTAD');

  // Info del programa
  sections.push(`
### Programa: ${program.name}
- Moneda de puntos: "${program.tokens_name}"
- Acumulación: ${program.tokens_per_currency} ${program.tokens_name} por cada $${program.tokens_currency_threshold} de compra
- Membresías disponibles: ${program.membership_enabled ? 'Sí' : 'No'}`);

  // Estado del lead (si está disponible)
  if (lead_status) {
    sections.push(`
### Estado del cliente actual:
- Balance de ${program.tokens_name}: **${lead_status.token_balance}**
- Total acumulado: ${lead_status.total_earned}
- Total canjeado: ${lead_status.total_redeemed}`);

    if (lead_status.membership_plan) {
      sections.push(`- Membresía activa: ${lead_status.membership_plan} (${lead_status.membership_status})${
        lead_status.membership_end_date ? ` - Vence: ${new Date(lead_status.membership_end_date).toLocaleDateString('es-MX')}` : ''
      }`);
    }
  }

  // Recompensas disponibles para canjear
  if (available_rewards.length > 0) {
    const rewards = available_rewards
      .slice(0, 5)
      .map(r => `- ${r.name}: ${r.tokens_required} ${program.tokens_name}`)
      .join('\n');
    sections.push(`\n### Recompensas que puede canjear:\n${rewards}`);
  } else if (lead_status && lead_status.token_balance > 0) {
    sections.push('\n### El cliente tiene puntos pero no alcanza para ninguna recompensa aún.');
  }

  sections.push(`
### Reglas para responder sobre lealtad:
- Si preguntan por puntos/balance: Informar el balance actual (${lead_status?.token_balance || 0} ${program.tokens_name})
- Si preguntan cómo ganar puntos: Explicar que ganan ${program.tokens_per_currency} ${program.tokens_name} por cada $${program.tokens_currency_threshold} de compra
- Si quieren canjear: ${available_rewards.length > 0 ? 'Mencionar las opciones disponibles' : 'Indicar que necesitan más puntos'}
- Si preguntan por membresías: ${program.membership_enabled ? 'Mencionar que hay planes disponibles' : 'Indicar que no hay programa de membresías activo'}`);

  return sections.join('\n');
}

// ======================
// MAIN SERVICE FUNCTION
// ======================

/**
 * Genera una respuesta AI usando el grafo LangGraph
 *
 * Esta función reemplaza a generateAIResponse() del ai.service.ts original.
 * Mantiene la misma interfaz de salida para compatibilidad.
 *
 * OPTIMIZACIÓN: Usa prompts pre-cacheados de ai_generated_prompts.
 * El prompt se determina según el canal de la conversación.
 *
 * ARQUITECTURA V6: Cuando está habilitada, usa prompt minimal (~1,200-1,500 tokens)
 * y los datos del negocio se obtienen via Tools dinámicamente.
 */
export async function generateAIResponseWithGraph(
  tenantId: string,
  conversationId: string,
  currentMessage: string,
  leadId?: string,
  channel?: CacheChannel
): Promise<AIProcessingResult> {
  const startTime = Date.now();

  console.log(`[LangGraph AI] Processing message for tenant ${tenantId}`);

  try {
    // REVISIÓN 5.4 G-I4: Sanitizar mensaje antes de procesar
    // Detecta y neutraliza intentos de prompt injection
    const sanitizationResult = PromptSanitizer.sanitizeUserPrompt(currentMessage);
    const sanitizedMessage = sanitizationResult.sanitized;

    if (sanitizationResult.wasModified) {
      console.warn(
        `[LangGraph AI] G-I4: Message sanitized. Risk: ${sanitizationResult.riskLevel}, ` +
        `Patterns: ${sanitizationResult.detectedPatterns.map(p => p.type).join(', ')}`
      );
    }

    // 0. Primero cargar el contexto de conversación para determinar el canal
    const conversationContext = await loadConversationContext(conversationId);
    const effectiveChannel = (channel || conversationContext?.channel || 'whatsapp') as CacheChannel;

    // 0.5 ARQUITECTURA V6: Determinar si usar prompt minimal
    const useMinimalPrompt = await shouldUseMinimalPromptV6(tenantId);
    if (useMinimalPrompt) {
      console.log(`[LangGraph AI] ARQUITECTURA V6 ACTIVA: Usando prompt minimal + tools dinámicos`);
    }

    // 1. Cargar todos los contextos en paralelo
    // REVISIÓN 5.5: Ahora incluye Learning y Loyalty context para mejorar respuestas
    // ARQUITECTURA V6: Pasa useMinimalPrompt a loadTenantContext
    const [tenantContext, leadContext, businessContext, learningContext, loyaltyContext] = await Promise.all([
      loadTenantContext(tenantId, effectiveChannel, 'business', useMinimalPrompt),
      leadId ? loadLeadContext(leadId) : Promise.resolve(null),
      loadBusinessContext(tenantId),
      loadLearningContext(tenantId),          // NUEVO: AI Learning patterns
      loadLoyaltyContext(tenantId, leadId),   // NUEVO: Loyalty program + lead status
    ]);

    if (!tenantContext) {
      throw new Error('Could not load tenant context');
    }

    // 2. Enriquecer el system_prompt con contexto de aprendizaje si está disponible
    // REVISIÓN 5.5: Retroalimentación del AI Learning al prompt
    if (learningContext && (
      learningContext.topServiceRequests.length > 0 ||
      learningContext.commonObjections.length > 0 ||
      learningContext.learnedVocabulary.length > 0
    )) {
      const learningEnrichment = buildLearningEnrichment(learningContext);
      tenantContext.ai_config.system_prompt = `${tenantContext.ai_config.system_prompt}\n\n${learningEnrichment}`;
      console.log('[LangGraph AI] System prompt enriched with learning context');
    }

    // 3. Enriquecer con contexto de loyalty si está disponible
    // REVISIÓN 5.5: El AI puede responder preguntas sobre puntos y membresías
    if (loyaltyContext?.program) {
      const loyaltyEnrichment = buildLoyaltyEnrichment(loyaltyContext);
      tenantContext.ai_config.system_prompt = `${tenantContext.ai_config.system_prompt}\n\n${loyaltyEnrichment}`;
      console.log('[LangGraph AI] System prompt enriched with loyalty context');
    }

    // 4. Preparar input para el grafo (usando mensaje sanitizado)
    const graphInput: GraphExecutionInput = {
      tenant_id: tenantId,
      conversation_id: conversationId,
      lead_id: leadId || '',
      current_message: sanitizedMessage, // G-I4: Usar mensaje sanitizado
      channel: effectiveChannel,
      tenant_context: tenantContext,
      lead_context: leadContext,
      conversation_context: conversationContext,
      business_context: businessContext,
    };

    // 5. Ejecutar el grafo
    const result = await executeGraph(graphInput);

    // 6. Convertir resultado al formato AIProcessingResult
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
// FEATURE FLAGS
// ======================

/**
 * ARQUITECTURA V6: Determina si usar el prompt minimal + tools dinámicos
 *
 * Prioridad de decisión:
 * 1. Variable de entorno USE_MINIMAL_PROMPT (override global)
 * 2. Configuración del tenant en ai_tenant_config.use_minimal_prompt_v6
 * 3. Default: false (usar prompt legacy completo)
 *
 * Cuando está activo:
 * - El prompt inicial es ~1,200-1,500 tokens (vs ~4,000 legacy)
 * - Los datos del negocio se obtienen via Tools dinámicamente
 * - Solo instrucciones críticas (include_in_prompt=true) van en el prompt
 */
export async function shouldUseMinimalPromptV6(tenantId: string): Promise<boolean> {
  // Feature flag global (override)
  if (process.env.USE_MINIMAL_PROMPT === 'true') {
    return true;
  }

  if (process.env.USE_MINIMAL_PROMPT === 'false') {
    return false;
  }

  // Verificar configuración del tenant en ai_tenant_config
  const supabase = createServerClient();
  const { data: config } = await supabase
    .from('ai_tenant_config')
    .select('use_minimal_prompt_v6')
    .eq('tenant_id', tenantId)
    .single();

  if (config?.use_minimal_prompt_v6 === true) {
    return true;
  }

  // Por defecto, usar legacy mientras se hace rollout gradual
  return false;
}

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
 *
 * ARQUITECTURA V7: Cuando use_v7_unified está activo, usa generateAIResponseV7
 * que garantiza el mismo código path que Preview.
 */
export async function generateAIResponseSmart(
  tenantId: string,
  conversationId: string,
  currentMessage: string,
  leadId?: string
): Promise<AIProcessingResult> {
  // ARQUITECTURA V7: Verificar si usar sistema unificado
  const { shouldUseV7, generateAIResponseV7 } = await import('./ai-v7.service');
  const useV7 = await shouldUseV7(tenantId);

  if (useV7) {
    console.log('[AI Router] Using V7 UNIFIED system (same as Preview)');

    // Determinar canal desde la conversación
    const conversationContext = await loadConversationContext(conversationId);
    const channel = (conversationContext?.channel || 'whatsapp') as CacheChannel;

    const result = await generateAIResponseV7(tenantId, currentMessage, {
      conversationId,
      leadId,
      channel,
      profileType: 'business', // Default para producción
      isPreview: false, // IMPORTANTE: false para producción
    });

    // Mapear resultado V7 a AIProcessingResult
    return {
      response: result.response,
      intent: result.intent as AIProcessingResult['intent'],
      signals: result.signals,
      score_change: result.score_change,
      escalate: result.escalated,
      escalate_reason: result.escalation_reason,
      tokens_used: result.tokens_used,
      model_used: result.model_used,
      processing_time_ms: result.processing_time_ms,
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
  }

  // Fallback: Sistema anterior (LangGraph o Legacy)
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
// PREVIEW RESPONSE (LIVE PREVIEW WITH FULL LANGGRAPH)
// ======================

/**
 * Interfaz para solicitud de preview
 */
export interface PreviewRequestInput {
  tenantId: string;
  message: string;
  profileType: ProfileType;
  channel?: CacheChannel;
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

/**
 * Interfaz para resultado de preview
 */
export interface PreviewResponseResult {
  success: boolean;
  response: string;
  intent: string;
  signals: Array<{ signal: string; points: number }>;
  score_change: number;
  processing_time_ms: number;
  tokens_used: number;
  model_used: string;
  agents_used: string[];
  escalated: boolean;
  escalation_reason?: string;
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

/**
 * Genera una respuesta de preview usando el flujo COMPLETO de LangGraph
 * Esta función es específica para el "Preview en vivo" del UI
 *
 * ARQUITECTURA V7: Ahora usa generateAIResponseV7 para garantizar
 * que Preview y Producción usen exactamente el mismo código path.
 *
 * CARACTERÍSTICAS:
 * - Usa la arquitectura completa LangGraph con Tools + RAG
 * - Soporta selección de perfil (business/personal)
 * - Soporta historial de conversación multi-turn
 * - Carga contexto real del tenant (Knowledge Base, servicios, etc.)
 * - Aplica configuración del perfil (response_style, template, delay)
 *
 * @param input - Parámetros del preview
 * @returns Resultado del preview con metadata completa
 */
export async function generatePreviewResponse(
  input: PreviewRequestInput
): Promise<PreviewResponseResult> {
  const { tenantId, message, profileType, channel = 'whatsapp', conversationHistory = [] } = input;

  console.log(`[LangGraph Preview V7] Starting preview for tenant ${tenantId}, profile: ${profileType}`);

  // ARQUITECTURA V7: Usar función unificada con isPreview=true
  const { generateAIResponseV7 } = await import('./ai-v7.service');

  const result = await generateAIResponseV7(tenantId, message, {
    channel: channel as CacheChannel,
    profileType,
    conversationHistory,
    isPreview: true, // CLAVE: indica modo preview
  });

  // Mapear resultado V7 a PreviewResponseResult
  return {
    success: result.success,
    response: result.response,
    intent: result.intent,
    signals: result.signals,
    score_change: result.score_change,
    processing_time_ms: result.processing_time_ms,
    tokens_used: result.tokens_used,
    model_used: result.model_used,
    agents_used: result.agents_used,
    escalated: result.escalated,
    escalation_reason: result.escalation_reason,
    profile_config: result.profile_config,
    prompt_source: result.prompt_source,
    error: result.error,
  };
}

/**
 * @deprecated Use generatePreviewResponse() instead.
 * Implementación legacy de preview (mantenida para referencia)
 */
async function _legacyGeneratePreviewResponse(
  input: PreviewRequestInput
): Promise<PreviewResponseResult> {
  const startTime = Date.now();
  const { tenantId, message, profileType, channel = 'whatsapp', conversationHistory = [] } = input;

  console.log(`[LangGraph Preview Legacy] Starting preview for tenant ${tenantId}, profile: ${profileType}`);

  try {
    // 1. Sanitizar mensaje
    const sanitizationResult = PromptSanitizer.sanitizeUserPrompt(message);
    const sanitizedMessage = sanitizationResult.sanitized;

    if (sanitizationResult.wasModified) {
      console.warn(
        `[LangGraph Preview] Message sanitized. Risk: ${sanitizationResult.riskLevel}, ` +
        `Patterns: ${sanitizationResult.detectedPatterns.map(p => p.type).join(', ')}`
      );
    }

    // 2. Determinar si usar prompt minimal
    const useMinimalPrompt = await shouldUseMinimalPromptV6(tenantId);
    if (useMinimalPrompt) {
      console.log(`[LangGraph Preview] ARQUITECTURA V6 ACTIVA: Usando prompt minimal + tools dinámicos`);
    }

    // 3. Cargar todos los contextos en PARALELO
    // IMPORTANTE: Usamos el profileType seleccionado por el usuario
    const [tenantContext, businessContext, learningContext, loyaltyContext] = await Promise.all([
      loadTenantContext(tenantId, channel, profileType, useMinimalPrompt),
      loadBusinessContext(tenantId),
      loadLearningContext(tenantId),
      loadLoyaltyContext(tenantId), // Sin leadId para preview
    ]);

    if (!tenantContext) {
      throw new Error('Could not load tenant context for preview');
    }

    // 4. Extraer configuración del perfil para el response
    const profileConfig = {
      profile_type: profileType,
      response_style: tenantContext.ai_config.response_style,
      template_key: tenantContext.agent_profile?.template_key || 'general_full',
      delay_minutes: tenantContext.agent_profile?.response_delay_minutes || 0,
      delay_first_only: tenantContext.agent_profile?.response_delay_first_only ?? true,
    };

    console.log(`[LangGraph Preview] Profile config:`, profileConfig);

    // 5. Enriquecer system_prompt con contexto de aprendizaje si existe
    if (learningContext && (
      learningContext.topServiceRequests.length > 0 ||
      learningContext.commonObjections.length > 0 ||
      learningContext.learnedVocabulary.length > 0
    )) {
      const learningEnrichment = buildLearningEnrichment(learningContext);
      tenantContext.ai_config.system_prompt = `${tenantContext.ai_config.system_prompt}\n\n${learningEnrichment}`;
      console.log('[LangGraph Preview] System prompt enriched with learning context');
    }

    // 6. Enriquecer con contexto de loyalty si existe
    if (loyaltyContext?.program) {
      const loyaltyEnrichment = buildLoyaltyEnrichment(loyaltyContext);
      tenantContext.ai_config.system_prompt = `${tenantContext.ai_config.system_prompt}\n\n${loyaltyEnrichment}`;
      console.log('[LangGraph Preview] System prompt enriched with loyalty context');
    }

    // 7. Construir contexto de conversación simulado para multi-turn
    // En preview NO tenemos una conversación real en DB, usamos el historial pasado
    const simulatedConversationContext: ConversationInfo = {
      conversation_id: `preview-${tenantId}-${Date.now()}`,
      channel: channel,
      status: 'active',
      ai_handling: true,
      message_count: conversationHistory.length + 1,
      started_at: new Date().toISOString(),
      last_message_at: new Date().toISOString(),
    };

    // 8. Preparar input para el grafo
    const graphInput: GraphExecutionInput = {
      tenant_id: tenantId,
      conversation_id: simulatedConversationContext.conversation_id,
      lead_id: '', // No hay lead en preview
      current_message: sanitizedMessage,
      channel: channel,
      tenant_context: tenantContext,
      lead_context: null, // No hay lead en preview
      conversation_context: simulatedConversationContext,
      business_context: businessContext,
      // IMPORTANTE: Pasar historial de conversación para multi-turn en preview
      previous_messages: conversationHistory,
    };

    // 9. Ejecutar el grafo LangGraph completo
    const result = await executeGraph(graphInput);

    const processingTime = Date.now() - startTime;

    console.log(`[LangGraph Preview] Completed in ${processingTime}ms. Agents: ${result.agents_used.join(' -> ')}`);

    return {
      success: result.success,
      response: result.response,
      intent: result.intent,
      signals: result.signals,
      score_change: result.score_change,
      processing_time_ms: processingTime,
      tokens_used: result.tokens_used,
      model_used: 'langgraph-gpt-5-mini',
      agents_used: result.agents_used,
      escalated: result.escalated,
      escalation_reason: result.escalation_reason,
      profile_config: profileConfig,
      prompt_source: tenantContext.prompt_source,
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('[LangGraph Preview] Error:', error);

    // Obtener configuración básica del perfil para el error response
    const defaultProfileConfig = {
      profile_type: profileType,
      response_style: 'professional_friendly',
      template_key: 'general_full',
      delay_minutes: profileType === 'personal' ? 8 : 0,
      delay_first_only: true,
    };

    return {
      success: false,
      response: 'Lo siento, ocurrió un error al generar la respuesta de preview.',
      intent: 'UNKNOWN',
      signals: [],
      score_change: 0,
      processing_time_ms: processingTime,
      tokens_used: 0,
      model_used: 'langgraph-error',
      agents_used: [],
      escalated: false,
      profile_config: defaultProfileConfig,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ======================
// EXPORTS
// ======================

export const LangGraphAIService = {
  generateResponse: generateAIResponseWithGraph,
  generateSmart: generateAIResponseSmart,
  generatePreview: generatePreviewResponse,  // NUEVO: Preview con LangGraph completo
  shouldUseLangGraph,
  shouldUseMinimalPromptV6,  // ARQUITECTURA V6
  loadTenantContext,
  loadLeadContext,
  loadConversationContext,
  loadBusinessContext,
};

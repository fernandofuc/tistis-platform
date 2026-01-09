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
  type CacheChannel,
} from './prompt-generator.service';

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
 * Carga el contexto del tenant para el grafo
 *
 * OPTIMIZACIÓN: Usa el prompt pre-cacheado de ai_generated_prompts
 * en lugar de reconstruir el system_prompt desde los datos raw.
 * Esto reduce significativamente los tokens por request.
 */
async function loadTenantContext(
  tenantId: string,
  channel: CacheChannel = 'whatsapp'
): Promise<TenantInfo | null> {
  const supabase = createServerClient();

  // 1. Cargar datos básicos del tenant y AI config
  const { data, error } = await supabase.rpc('get_tenant_ai_context', {
    p_tenant_id: tenantId,
  });

  if (error || !data) {
    console.error('[LangGraph AI] Error loading tenant context:', error);
    return null;
  }

  // 2. Obtener prompt optimizado del caché
  // Este es el prompt pre-generado por Gemini, mucho más conciso y estructurado
  const { prompt: cachedPrompt, fromCache, version } = await getOptimizedPrompt(tenantId, channel);

  if (fromCache) {
    console.log(`[LangGraph AI] Using cached prompt v${version} for channel ${channel}`);
  } else if (cachedPrompt) {
    console.log(`[LangGraph AI] Using freshly generated prompt for channel ${channel}`);
  }

  // 3. Usar el prompt cacheado si existe, sino usar el de ai_config
  const systemPrompt = cachedPrompt || data.ai_config?.system_prompt || '';

  // Mapear al formato del estado
  return {
    tenant_id: data.tenant_id,
    tenant_name: data.tenant_name,
    vertical: data.vertical || 'general',
    timezone: data.timezone || 'America/Mexico_City',
    ai_config: {
      system_prompt: systemPrompt,
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
 * Para restaurantes: También carga el menú completo con categorías
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

  const [coreResult, externalResult, menuResult] = await Promise.all([
    supabase.rpc('get_tenant_ai_context', { p_tenant_id: tenantId }),
    loadExternalData(),
    loadRestaurantMenu(),
  ]);

  const { data, error } = coreResult;
  const externalData = externalResult?.data;
  const menuData = menuResult;

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
 *
 * OPTIMIZACIÓN: Usa prompts pre-cacheados de ai_generated_prompts.
 * El prompt se determina según el canal de la conversación.
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
    // 0. Primero cargar el contexto de conversación para determinar el canal
    const conversationContext = await loadConversationContext(conversationId);
    const effectiveChannel = (channel || conversationContext?.channel || 'whatsapp') as CacheChannel;

    // 1. Cargar todos los contextos en paralelo
    // Nota: loadTenantContext ahora usa el prompt cacheado según el canal
    const [tenantContext, leadContext, businessContext] = await Promise.all([
      loadTenantContext(tenantId, effectiveChannel),
      leadId ? loadLeadContext(leadId) : Promise.resolve(null),
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
      channel: effectiveChannel,
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

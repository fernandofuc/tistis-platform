// =====================================================
// TIS TIS PLATFORM - Shared Business Context Service
// Unified context provider for all AI systems
// Used by: Setup Assistant, Chat AI, Voice Agent
// =====================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// =====================================================
// TYPES
// =====================================================

export interface BusinessContextBase {
  tenant_id: string;
  tenant_name: string;
  vertical: 'dental' | 'restaurant' | 'clinic' | 'gym' | 'beauty' | 'veterinary';
  timezone: string;
  plan: string;
}

export interface ServiceInfo {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  duration_minutes: number | null;
  category: string | null;
  is_popular: boolean;
}

export interface BranchInfo {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  hours: Record<string, unknown> | null;
  is_main: boolean;
}

export interface FAQInfo {
  id: string;
  question: string;
  answer: string;
  category: string | null;
}

export interface PromotionInfo {
  id: string;
  title: string;
  description: string | null;
  discount_type: 'percentage' | 'fixed' | 'bundle';
  discount_value: number;
  valid_from: string | null;
  valid_to: string | null;
  conditions: string | null;
}

export interface KnowledgeDocInfo {
  id: string;
  title: string;
  content: string;
  type: string;
  include_in_prompt: boolean;
}

export interface AIConfig {
  system_prompt: string;
  model: string;
  temperature: number;
  response_style: string;
  max_response_length: number;
  auto_escalate_keywords: string[];
}

export interface BusinessContext {
  base: BusinessContextBase;
  services: ServiceInfo[];
  branches: BranchInfo[];
  faqs: FAQInfo[];
  promotions: PromotionInfo[];
  knowledge_docs: KnowledgeDocInfo[];
  ai_config: AIConfig | null;
}

export interface ContextLoadOptions {
  /** Load services catalog */
  includeServices?: boolean;
  /** Load branches */
  includeBranches?: boolean;
  /** Load FAQs */
  includeFAQs?: boolean;
  /** Load promotions */
  includePromotions?: boolean;
  /** Load knowledge base documents */
  includeKnowledgeDocs?: boolean;
  /** Load AI configuration */
  includeAIConfig?: boolean;
  /** Filter knowledge docs to only those marked for prompt inclusion */
  onlyPromptDocs?: boolean;
  /** Limit number of services */
  servicesLimit?: number;
  /** Limit number of FAQs */
  faqsLimit?: number;
}

const DEFAULT_OPTIONS: ContextLoadOptions = {
  includeServices: true,
  includeBranches: true,
  includeFAQs: true,
  includePromotions: true,
  includeKnowledgeDocs: true,
  includeAIConfig: true,
  onlyPromptDocs: true,
  servicesLimit: 50,
  faqsLimit: 30,
};

// =====================================================
// SUPABASE CLIENT
// =====================================================

function createServerClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase credentials not configured');
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

// =====================================================
// BUSINESS CONTEXT SERVICE CLASS
// =====================================================

export class BusinessContextService {
  private static instance: BusinessContextService;

  // In-memory cache for frequently accessed contexts
  private cache: Map<string, { context: BusinessContext; timestamp: number }>;
  private readonly cacheTTL = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    this.cache = new Map();
  }

  static getInstance(): BusinessContextService {
    if (!BusinessContextService.instance) {
      BusinessContextService.instance = new BusinessContextService();
    }
    return BusinessContextService.instance;
  }

  /**
   * Load full business context for a tenant
   * Uses RPC for efficient data loading
   */
  async loadContext(
    tenantId: string,
    options: ContextLoadOptions = {}
  ): Promise<BusinessContext | null> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    // Check cache first
    const cacheKey = this.getCacheKey(tenantId, opts);
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    const supabase = createServerClient();

    try {
      // Use the existing RPC that already aggregates context
      const { data, error } = await supabase.rpc('get_tenant_ai_context', {
        p_tenant_id: tenantId,
      });

      if (error) {
        console.error('[BusinessContextService] Error loading context:', error);
        return null;
      }

      if (!data) {
        console.warn('[BusinessContextService] No context found for tenant:', tenantId);
        return null;
      }

      // Transform RPC response to BusinessContext
      const context = this.transformRPCResponse(data, opts);

      // Store in cache
      this.setToCache(cacheKey, context);

      return context;
    } catch (error) {
      console.error('[BusinessContextService] Unexpected error:', error);
      return null;
    }
  }

  /**
   * Load minimal context (just base info)
   * Useful for quick lookups
   */
  async loadMinimalContext(tenantId: string): Promise<BusinessContextBase | null> {
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('tenants')
      .select('id, name, vertical, timezone, plan')
      .eq('id', tenantId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      tenant_id: data.id,
      tenant_name: data.name,
      vertical: data.vertical,
      timezone: data.timezone || 'America/Mexico_City',
      plan: data.plan || 'starter',
    };
  }

  /**
   * Load context for Setup Assistant
   * Includes all info needed for configuration
   */
  async loadSetupContext(tenantId: string): Promise<BusinessContext | null> {
    return this.loadContext(tenantId, {
      includeServices: true,
      includeBranches: true,
      includeFAQs: true,
      includePromotions: true,
      includeKnowledgeDocs: true,
      includeAIConfig: true,
      onlyPromptDocs: false, // Include all docs for setup
    });
  }

  /**
   * Load context for Chat AI
   * Optimized for conversation handling
   */
  async loadChatContext(tenantId: string): Promise<BusinessContext | null> {
    return this.loadContext(tenantId, {
      includeServices: true,
      includeBranches: true,
      includeFAQs: true,
      includePromotions: true,
      includeKnowledgeDocs: true,
      includeAIConfig: true,
      onlyPromptDocs: true, // Only docs marked for prompt
      servicesLimit: 30,
      faqsLimit: 20,
    });
  }

  /**
   * Load context for Voice Agent
   * Optimized for voice interactions
   */
  async loadVoiceContext(tenantId: string): Promise<BusinessContext | null> {
    return this.loadContext(tenantId, {
      includeServices: true,
      includeBranches: true,
      includeFAQs: true,
      includePromotions: false, // Voice doesn't need promotions initially
      includeKnowledgeDocs: true,
      includeAIConfig: true,
      onlyPromptDocs: true,
      servicesLimit: 20, // Smaller set for voice
      faqsLimit: 15,
    });
  }

  /**
   * Invalidate cache for a tenant
   * Call this when tenant config changes
   * Emits event to notify other services
   */
  invalidateCache(tenantId: string, emitEvent: boolean = true): void {
    // Remove all cache entries for this tenant
    for (const key of this.cache.keys()) {
      if (key.startsWith(tenantId)) {
        this.cache.delete(key);
      }
    }
    console.log('[BusinessContextService] Cache invalidated for tenant:', tenantId);

    // Emit event for other services to react
    if (emitEvent) {
      // Dynamic import to avoid circular dependency
      import('./event-bus.service').then(({ emitCacheInvalidation }) => {
        emitCacheInvalidation(tenantId, ['business_context'], 'cache_invalidation_request');
      }).catch(() => {
        // Event bus not available, continue without it
      });
    }
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('[BusinessContextService] Cache cleared');
  }

  // =====================================================
  // PRIVATE METHODS
  // =====================================================

  private getCacheKey(tenantId: string, options: ContextLoadOptions): string {
    const optionsHash = JSON.stringify(options);
    return `${tenantId}:${optionsHash}`;
  }

  private getFromCache(key: string): BusinessContext | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.cacheTTL) {
      this.cache.delete(key);
      return null;
    }

    return entry.context;
  }

  private setToCache(key: string, context: BusinessContext): void {
    // Enforce max cache size
    if (this.cache.size >= 100) {
      // Delete oldest entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      context,
      timestamp: Date.now(),
    });
  }

  private transformRPCResponse(
    data: Record<string, unknown>,
    options: ContextLoadOptions
  ): BusinessContext {
    const tenantConfig = data.tenant_config as Record<string, unknown> || {};

    const base: BusinessContextBase = {
      tenant_id: tenantConfig.id as string || '',
      tenant_name: tenantConfig.name as string || 'Negocio',
      vertical: tenantConfig.vertical as BusinessContextBase['vertical'] || 'dental',
      timezone: tenantConfig.timezone as string || 'America/Mexico_City',
      plan: tenantConfig.plan as string || 'starter',
    };

    let services: ServiceInfo[] = [];
    if (options.includeServices && Array.isArray(data.services)) {
      services = (data.services as Array<Record<string, unknown>>).map((s) => ({
        id: s.id as string,
        name: s.name as string,
        description: s.description as string | null,
        price: s.price as number | null,
        duration_minutes: s.duration_minutes as number | null,
        category: s.category as string | null,
        is_popular: s.is_popular as boolean || false,
      }));

      if (options.servicesLimit) {
        services = services.slice(0, options.servicesLimit);
      }
    }

    let branches: BranchInfo[] = [];
    if (options.includeBranches && Array.isArray(data.branches)) {
      branches = (data.branches as Array<Record<string, unknown>>).map((b) => ({
        id: b.id as string,
        name: b.name as string,
        address: b.address as string | null,
        phone: b.phone as string | null,
        hours: b.hours as Record<string, unknown> | null,
        is_main: b.is_main as boolean || false,
      }));
    }

    let faqs: FAQInfo[] = [];
    if (options.includeFAQs && Array.isArray(data.faqs)) {
      faqs = (data.faqs as Array<Record<string, unknown>>).map((f) => ({
        id: f.id as string,
        question: f.question as string,
        answer: f.answer as string,
        category: f.category as string | null,
      }));

      if (options.faqsLimit) {
        faqs = faqs.slice(0, options.faqsLimit);
      }
    }

    let promotions: PromotionInfo[] = [];
    if (options.includePromotions && Array.isArray(data.promotions)) {
      promotions = (data.promotions as Array<Record<string, unknown>>).map((p) => ({
        id: p.id as string,
        title: p.title as string,
        description: p.description as string | null,
        discount_type: p.discount_type as PromotionInfo['discount_type'] || 'percentage',
        discount_value: p.discount_value as number || 0,
        valid_from: p.valid_from as string | null,
        valid_to: p.valid_to as string | null,
        conditions: p.conditions as string | null,
      }));
    }

    let knowledgeDocs: KnowledgeDocInfo[] = [];
    if (options.includeKnowledgeDocs && Array.isArray(data.knowledge_base)) {
      knowledgeDocs = (data.knowledge_base as Array<Record<string, unknown>>)
        .filter((d) => !options.onlyPromptDocs || d.include_in_prompt)
        .map((d) => ({
          id: d.id as string,
          title: d.title as string,
          content: d.content as string,
          type: d.type as string,
          include_in_prompt: d.include_in_prompt as boolean || false,
        }));
    }

    let aiConfig: AIConfig | null = null;
    if (options.includeAIConfig && tenantConfig.ai_config) {
      const config = tenantConfig.ai_config as Record<string, unknown>;
      aiConfig = {
        system_prompt: config.system_prompt as string || '',
        model: config.model as string || 'gpt-4o-mini',
        temperature: config.temperature as number || 0.7,
        response_style: config.response_style as string || 'professional',
        max_response_length: config.max_response_length as number || 500,
        auto_escalate_keywords: config.auto_escalate_keywords as string[] || [],
      };
    }

    return {
      base,
      services,
      branches,
      faqs,
      promotions,
      knowledge_docs: knowledgeDocs,
      ai_config: aiConfig,
    };
  }
}

// =====================================================
// SINGLETON EXPORT
// =====================================================

export const businessContextService = BusinessContextService.getInstance();

// =====================================================
// CONVENIENCE FUNCTIONS
// =====================================================

/**
 * Quick load business context
 */
export async function loadBusinessContext(
  tenantId: string
): Promise<BusinessContext | null> {
  return businessContextService.loadContext(tenantId);
}

/**
 * Load context for Setup Assistant
 */
export async function loadSetupContext(
  tenantId: string
): Promise<BusinessContext | null> {
  return businessContextService.loadSetupContext(tenantId);
}

/**
 * Load context for Chat AI
 */
export async function loadChatContext(
  tenantId: string
): Promise<BusinessContext | null> {
  return businessContextService.loadChatContext(tenantId);
}

/**
 * Load context for Voice Agent
 */
export async function loadVoiceContext(
  tenantId: string
): Promise<BusinessContext | null> {
  return businessContextService.loadVoiceContext(tenantId);
}

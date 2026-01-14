// =====================================================
// TIS TIS PLATFORM - AI Preview API
// Genera respuestas de preview usando datos reales del negocio
// =====================================================
// Este endpoint permite probar cómo responde el asistente
// usando la configuración real de Knowledge Base y Agent Profiles.
// NO guarda conversaciones ni afecta datos del negocio.
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { type TenantAIContext } from '@/src/features/ai/services/ai.service';
import {
  getOptimizedPrompt,
  type CacheChannel,
} from '@/src/features/ai/services/prompt-generator.service';
import {
  checkRateLimit,
  getClientIP,
  aiLimiter,
  rateLimitExceeded,
} from '@/src/shared/lib/rate-limit';
import { DEFAULT_MODELS, OPENAI_CONFIG } from '@/src/shared/config/ai-models';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// ======================
// CONFIGURATION
// ======================

const LLM_TIMEOUT_MS = 15000; // 15s timeout for preview (shorter than production)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
  timeout: LLM_TIMEOUT_MS,
  maxRetries: 1, // Only 1 retry for preview
});

// ======================
// TYPES
// ======================

interface PreviewRequest {
  message: string;
  profile_type?: 'business' | 'personal';
  scenario_id?: string;
  response_style_override?: string;
}

interface PreviewResponse {
  success: boolean;
  response?: string;
  intent?: string;
  signals?: Array<{ signal: string; points: number }>;
  processing_time_ms?: number;
  model_used?: string;
  prompt_from_cache?: boolean;
  prompt_version?: number;
  tokens_used?: number;
  vertical?: string;
  profile_type?: string;
  error?: string;
}

// ======================
// HELPER FUNCTIONS
// ======================

// Create Supabase client with user's access token
function createAuthenticatedClient(accessToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    }
  );
}

// Extract Bearer token from Authorization header
function getAccessToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

// Get user context (user + tenant)
async function getUserContext(supabase: ReturnType<typeof createAuthenticatedClient>) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return null;

  const { data: userRole } = await supabase
    .from('user_roles')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .single();

  if (!userRole) return null;

  return { user, userRole };
}

// ======================
// DIRECT TENANT CONTEXT LOADER
// ======================
// Load tenant context directly from tables (doesn't require RPC function)
async function loadTenantContextDirect(
  supabase: SupabaseClient,
  tenantId: string
): Promise<TenantAIContext | null> {
  try {
    // 1. Load tenant basic info
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name, vertical, timezone, ai_config')
      .eq('id', tenantId)
      .single();

    if (tenantError || !tenant) {
      console.error('[AI Preview] Error loading tenant:', tenantError);
      return null;
    }

    // 2. Load all related data in parallel for performance
    // NOTE: Using individual try-catch per query to handle missing tables gracefully
    type QueryResult = { data: Record<string, unknown>[] | null; error: { message?: string } | null };
    const safeQuery = async (
      queryFn: () => PromiseLike<QueryResult>,
      tableName: string
    ): Promise<Record<string, unknown>[]> => {
      try {
        const result = await queryFn();
        if (result.error) {
          console.warn(`[AI Preview] Query error for ${tableName}:`, result.error.message || result.error);
          return [];
        }
        return result.data || [];
      } catch (e) {
        console.warn(`[AI Preview] Query exception for ${tableName}:`, e);
        return [];
      }
    };

    const [
      servicesData,
      branchesData,
      customInstructionsData,
      businessPoliciesData,
      knowledgeArticlesData,
      responseTemplatesData,
      competitorHandlingData,
      scoringRulesData,
    ] = await Promise.all([
      // Services
      safeQuery(
        () => supabase
          .from('services')
          .select('id, name, description, ai_description, price_min, price_max, price_note, duration_minutes, category, special_instructions, requires_consultation, promotion_active, promotion_text')
          .eq('tenant_id', tenantId)
          .eq('is_active', true)
          .order('display_order', { ascending: true }),
        'services'
      ),

      // Branches
      safeQuery(
        () => supabase
          .from('branches')
          .select('id, name, address, city, phone, whatsapp_number, email, operating_hours, google_maps_url, is_headquarters')
          .eq('tenant_id', tenantId)
          .eq('is_active', true),
        'branches'
      ),

      // Custom Instructions (Knowledge Base)
      // Column names: instruction_type (not type), instruction, examples
      safeQuery(
        () => supabase
          .from('ai_custom_instructions')
          .select('instruction_type, title, instruction, examples, branch_id')
          .eq('tenant_id', tenantId)
          .eq('is_active', true)
          .order('priority', { ascending: false }),
        'ai_custom_instructions'
      ),

      // Business Policies (Knowledge Base)
      // Column names: policy_type (not type), policy_text (not policy)
      safeQuery(
        () => supabase
          .from('ai_business_policies')
          .select('policy_type, title, policy_text, short_version')
          .eq('tenant_id', tenantId)
          .eq('is_active', true),
        'ai_business_policies'
      ),

      // Knowledge Articles (Knowledge Base)
      safeQuery(
        () => supabase
          .from('ai_knowledge_articles')
          .select('category, title, content, summary, branch_id')
          .eq('tenant_id', tenantId)
          .eq('is_active', true),
        'ai_knowledge_articles'
      ),

      // Response Templates (Knowledge Base)
      // Column names: trigger_type (not trigger), template_text (not template), variables_available (not variables)
      safeQuery(
        () => supabase
          .from('ai_response_templates')
          .select('trigger_type, name, template_text, variables_available, branch_id')
          .eq('tenant_id', tenantId)
          .eq('is_active', true),
        'ai_response_templates'
      ),

      // Competitor Handling (Knowledge Base)
      // Column names: competitor_name, competitor_aliases, response_strategy
      safeQuery(
        () => supabase
          .from('ai_competitor_handling')
          .select('competitor_name, competitor_aliases, response_strategy, talking_points, avoid_saying')
          .eq('tenant_id', tenantId)
          .eq('is_active', true),
        'ai_competitor_handling'
      ),

      // Scoring Rules - try ai_scoring_rules first, fallback to lead_scoring_rules
      safeQuery(
        () => supabase
          .from('ai_scoring_rules')
          .select('signal_name, points, detection_config, category')
          .eq('tenant_id', tenantId)
          .eq('is_active', true),
        'ai_scoring_rules'
      ),
    ]);

    // Build the context object
    const aiConfig = tenant.ai_config || {};

    const context: TenantAIContext = {
      tenant_id: tenant.id,
      tenant_name: tenant.name,
      vertical: tenant.vertical || 'general',
      timezone: tenant.timezone || 'America/Mexico_City',
      ai_config: {
        system_prompt: aiConfig.system_prompt || '',
        model: aiConfig.model || DEFAULT_MODELS.MESSAGING,
        temperature: aiConfig.temperature ?? OPENAI_CONFIG.defaultTemperature,
        response_style: aiConfig.response_style || 'professional_friendly',
        max_response_length: aiConfig.max_response_length || 300,
        enable_scoring: aiConfig.enable_scoring ?? true,
        auto_escalate_keywords: aiConfig.auto_escalate_keywords || [],
        business_hours: aiConfig.business_hours || {
          start: '09:00',
          end: '18:00',
          days: [1, 2, 3, 4, 5],
        },
      },
      services: servicesData.map((s: any) => ({
        id: s.id,
        name: s.name,
        description: s.description || '',
        ai_description: s.ai_description,
        price_min: s.price_min || 0,
        price_max: s.price_max || 0,
        price_note: s.price_note,
        duration_minutes: s.duration_minutes || 30,
        category: s.category || 'general',
        special_instructions: s.special_instructions,
        requires_consultation: s.requires_consultation,
        promotion_active: s.promotion_active,
        promotion_text: s.promotion_text,
      })),
      faqs: [], // FAQs are typically loaded separately if needed
      branches: branchesData.map((b: any) => ({
        id: b.id,
        name: b.name,
        address: b.address || '',
        city: b.city || '',
        phone: b.phone || '',
        whatsapp_number: b.whatsapp_number || '',
        email: b.email || '',
        operating_hours: b.operating_hours || {},
        google_maps_url: b.google_maps_url || '',
        is_headquarters: b.is_headquarters || false,
        staff_ids: [],
      })),
      doctors: [], // Staff/Doctors loaded separately if needed
      // Map scoring rules - handle both ai_scoring_rules format and legacy format
      scoring_rules: scoringRulesData.map((r: any) => ({
        signal_name: r.signal_name,
        points: r.points,
        // ai_scoring_rules uses detection_config->keywords, legacy uses keywords directly
        keywords: r.detection_config?.keywords || r.keywords || [],
        category: r.category || 'general',
      })),
      // Knowledge Base data - map column names to expected interface
      custom_instructions: customInstructionsData.map((ci: any) => ({
        type: ci.instruction_type,
        title: ci.title,
        instruction: ci.instruction,
        examples: ci.examples,
        branch_id: ci.branch_id,
      })),
      business_policies: businessPoliciesData.map((bp: any) => ({
        type: bp.policy_type,
        title: bp.title,
        policy: bp.policy_text,
        short_version: bp.short_version,
      })),
      knowledge_articles: knowledgeArticlesData.map((ka: any) => ({
        category: ka.category,
        title: ka.title,
        content: ka.content,
        summary: ka.summary,
        branch_id: ka.branch_id,
      })),
      response_templates: responseTemplatesData.map((rt: any) => ({
        trigger: rt.trigger_type,
        name: rt.name,
        template: rt.template_text,
        variables: rt.variables_available,
        branch_id: rt.branch_id,
      })),
      competitor_handling: competitorHandlingData.map((ch: any) => ({
        competitor: ch.competitor_name,
        aliases: ch.competitor_aliases,
        strategy: ch.response_strategy,
        talking_points: ch.talking_points,
        avoid_saying: ch.avoid_saying,
      })),
    };

    console.log(`[AI Preview] Loaded context for tenant ${tenantId}: ${context.services.length} services, ${context.branches.length} branches, ${context.custom_instructions?.length || 0} instructions`);

    return context;
  } catch (error) {
    console.error('[AI Preview] Error loading tenant context:', error);
    return null;
  }
}

// Detect intent from message
function detectIntent(message: string): string {
  const messageLower = message.toLowerCase();

  if (/hola|buenos|buenas|hi|hello/i.test(messageLower)) {
    return 'GREETING';
  }
  if (/precio|costo|cuanto|valor|cotiz/i.test(messageLower)) {
    return 'PRICE_INQUIRY';
  }
  if (/cita|agendar|reservar|disponib/i.test(messageLower)) {
    return 'BOOK_APPOINTMENT';
  }
  if (/dolor|duele|molest|urgen|emergen/i.test(messageLower)) {
    return 'PAIN_URGENT';
  }
  if (/donde|ubicacion|direccion|llegar|mapa/i.test(messageLower)) {
    return 'LOCATION';
  }
  if (/horario|abren|cierran|atienden/i.test(messageLower)) {
    return 'HOURS';
  }
  if (/humano|persona|asesor|gerente/i.test(messageLower)) {
    return 'HUMAN_REQUEST';
  }

  return 'GENERAL_INQUIRY';
}

// Detect signals from message using tenant's scoring rules
function detectSignals(
  message: string,
  scoringRules: TenantAIContext['scoring_rules']
): Array<{ signal: string; points: number }> {
  const signals: Array<{ signal: string; points: number }> = [];
  const messageLower = message.toLowerCase();

  if (!scoringRules) return signals;

  for (const rule of scoringRules) {
    for (const keyword of rule.keywords) {
      if (messageLower.includes(keyword.toLowerCase())) {
        signals.push({
          signal: rule.signal_name,
          points: rule.points,
        });
        break; // Solo contar una vez por regla
      }
    }
  }

  return signals;
}

// Build system prompt from tenant context (fallback if no cached prompt)
function buildFallbackSystemPrompt(tenant: TenantAIContext): string {
  const {
    tenant_name,
    ai_config,
    services,
    branches,
    custom_instructions,
    business_policies,
  } = tenant;

  let systemPrompt = ai_config?.system_prompt || '';

  // Add business context if no system prompt exists
  if (!systemPrompt) {
    systemPrompt = `Eres un asistente virtual profesional de ${tenant_name}.
Ayudas a los clientes con información sobre servicios, precios, ubicaciones y citas.
Responde de manera amable, profesional y concisa.`;
  }

  // Add services context
  if (services && services.length > 0) {
    systemPrompt += '\n\n# SERVICIOS DISPONIBLES\n';
    for (const service of services.slice(0, 10)) {
      const priceInfo = service.price_min
        ? service.price_max && service.price_max !== service.price_min
          ? `$${service.price_min} - $${service.price_max} MXN`
          : `$${service.price_min} MXN`
        : 'Consultar';
      systemPrompt += `- ${service.name}: ${priceInfo}\n`;
      if (service.description) {
        systemPrompt += `  ${service.description}\n`;
      }
    }
  }

  // Add branch info
  if (branches && branches.length > 0) {
    systemPrompt += '\n\n# UBICACIONES\n';
    for (const branch of branches) {
      systemPrompt += `- ${branch.name}: ${branch.address}, ${branch.city}\n`;
      if (branch.phone) {
        systemPrompt += `  Tel: ${branch.phone}\n`;
      }
    }
  }

  // Add custom instructions
  if (custom_instructions && custom_instructions.length > 0) {
    systemPrompt += '\n\n# INSTRUCCIONES ESPECIALES\n';
    for (const inst of custom_instructions) {
      systemPrompt += `- ${inst.title}: ${inst.instruction}\n`;
    }
  }

  // Add business policies
  if (business_policies && business_policies.length > 0) {
    systemPrompt += '\n\n# POLÍTICAS DEL NEGOCIO\n';
    for (const policy of business_policies) {
      systemPrompt += `- ${policy.title}: ${policy.short_version || policy.policy}\n`;
    }
  }

  return systemPrompt;
}

// ======================
// POST - Generate AI Preview Response
// ======================
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // Rate limiting: 10 previews per minute per IP (more restrictive than production)
  const clientIP = getClientIP(request);
  const rateLimitResult = checkRateLimit(clientIP, aiLimiter);

  if (!rateLimitResult.success) {
    return rateLimitExceeded(rateLimitResult);
  }

  try {
    // 1. Authenticate user
    const accessToken = getAccessToken(request);
    if (!accessToken) {
      return NextResponse.json<PreviewResponse>(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    const supabase = createAuthenticatedClient(accessToken);
    const context = await getUserContext(supabase);

    if (!context) {
      return NextResponse.json<PreviewResponse>(
        { success: false, error: 'No autorizado' },
        { status: 403 }
      );
    }

    // 2. Parse request body
    const body = await request.json() as PreviewRequest;
    const { message, profile_type = 'business' } = body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json<PreviewResponse>(
        { success: false, error: 'Mensaje vacío' },
        { status: 400 }
      );
    }

    // Security: Limit message length to prevent abuse
    const MAX_MESSAGE_LENGTH = 500;
    const trimmedMessage = message.trim().slice(0, MAX_MESSAGE_LENGTH);

    const tenantId = context.userRole.tenant_id;

    // 3. Load tenant context directly (includes Knowledge Base data)
    // Using direct queries instead of RPC for better compatibility
    const tenantContext = await loadTenantContextDirect(supabase, tenantId);

    if (!tenantContext) {
      console.error(`[AI Preview] Failed to load context for tenant ${tenantId}`);
      return NextResponse.json<PreviewResponse>(
        { success: false, error: 'No se pudo cargar el contexto del negocio. Verifica que el tenant tenga datos configurados.' },
        { status: 500 }
      );
    }

    // 4. Detect intent and signals
    const intent = detectIntent(trimmedMessage);
    const signals = detectSignals(trimmedMessage, tenantContext.scoring_rules || []);

    // 5. Get optimized prompt (cached or generate fresh)
    const channel: CacheChannel = 'whatsapp'; // Use WhatsApp as default for messaging preview
    let systemPrompt: string;
    let promptFromCache = false;
    let promptVersion: number | undefined;

    try {
      const promptResult = await getOptimizedPrompt(tenantId, channel);
      systemPrompt = promptResult.prompt;
      promptFromCache = promptResult.fromCache;
      promptVersion = promptResult.version;

      // If no cached prompt exists, build a fallback
      if (!systemPrompt) {
        console.warn(`[AI Preview] No cached prompt for tenant ${tenantId}, using fallback`);
        systemPrompt = buildFallbackSystemPrompt(tenantContext);
      }
    } catch (promptError) {
      console.error('[AI Preview] Error getting cached prompt:', promptError);
      systemPrompt = buildFallbackSystemPrompt(tenantContext);
    }

    // 6. Load agent profile overrides (if any)
    const { data: agentProfile } = await supabase
      .from('agent_profiles')
      .select('response_style, custom_instructions_override')
      .eq('tenant_id', tenantId)
      .eq('profile_type', profile_type)
      .eq('is_active', true)
      .single();

    // Apply profile-specific customizations
    if (agentProfile?.custom_instructions_override) {
      systemPrompt += `\n\n# INSTRUCCIONES ADICIONALES DEL PERFIL\n${agentProfile.custom_instructions_override}`;
    }

    // Add response style instruction
    const responseStyle = agentProfile?.response_style || 'professional_friendly';
    const styleInstructions: Record<string, string> = {
      professional: 'Responde de manera formal y directa. Usa "usted" en todo momento.',
      professional_friendly: 'Responde de manera profesional pero cálida. Flexible entre "tú" y "usted" según el cliente.',
      casual: 'Responde de manera informal y cercana. Usa "tú" y expresiones coloquiales amigables.',
      formal: 'Responde de manera muy formal e institucional. Usa "usted" y lenguaje técnico preciso.',
    };

    if (styleInstructions[responseStyle]) {
      systemPrompt += `\n\n# ESTILO DE RESPUESTA\n${styleInstructions[responseStyle]}`;
    }

    // 7. Call OpenAI for preview response
    const model = DEFAULT_MODELS.MESSAGING; // gpt-5-mini
    const temperature = tenantContext.ai_config?.temperature || OPENAI_CONFIG.defaultTemperature;

    let aiResponse: string;
    let tokensUsed = 0;

    try {
      const completion = await openai.chat.completions.create({
        model,
        max_tokens: 300, // Shorter responses for preview
        temperature,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: trimmedMessage },
        ],
      });

      aiResponse = completion.choices[0]?.message?.content ||
        'Lo siento, no pude generar una respuesta. Verifica tu configuración de AI.';
      tokensUsed = (completion.usage?.prompt_tokens || 0) + (completion.usage?.completion_tokens || 0);
    } catch (openaiError) {
      const errorMessage = openaiError instanceof Error ? openaiError.message : 'Error desconocido';
      console.error('[AI Preview] OpenAI API error:', errorMessage);

      // Provide helpful error message based on error type
      if (errorMessage.includes('timeout')) {
        aiResponse = 'La respuesta está tardando demasiado. Intenta con un mensaje más corto.';
      } else if (errorMessage.includes('rate_limit') || errorMessage.includes('429')) {
        aiResponse = 'Límite de uso alcanzado. Espera unos segundos e intenta de nuevo.';
      } else if (errorMessage.includes('insufficient_quota')) {
        aiResponse = 'El servicio de AI no está disponible. Contacta al administrador.';
      } else {
        aiResponse = 'Error al generar la respuesta. Verifica la configuración de tu asistente.';
      }
    }

    // 8. Calculate processing time and return response
    const processingTime = Date.now() - startTime;

    return NextResponse.json<PreviewResponse>({
      success: true,
      response: aiResponse,
      intent,
      signals,
      processing_time_ms: processingTime,
      model_used: model,
      prompt_from_cache: promptFromCache,
      prompt_version: promptVersion,
      tokens_used: tokensUsed,
      vertical: tenantContext.vertical,
      profile_type,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    console.error('[AI Preview] Unexpected error:', error);

    return NextResponse.json<PreviewResponse>(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

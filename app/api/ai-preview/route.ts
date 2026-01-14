// =====================================================
// TIS TIS PLATFORM - AI Preview API
// Genera respuestas de preview usando datos reales del negocio
// =====================================================
// Este endpoint permite probar cómo responde el asistente
// usando la configuración real de Knowledge Base y Agent Profiles.
// NO guarda conversaciones ni afecta datos del negocio.
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import {
  getTenantAIContext,
  type TenantAIContext,
} from '@/src/features/ai/services/ai.service';
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

    // 3. Load tenant context (includes Knowledge Base data)
    const tenantContext = await getTenantAIContext(tenantId);

    if (!tenantContext) {
      return NextResponse.json<PreviewResponse>(
        { success: false, error: 'No se pudo cargar el contexto del negocio' },
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

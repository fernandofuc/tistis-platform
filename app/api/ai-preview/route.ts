// =====================================================
// TIS TIS PLATFORM - AI Preview API v2 (LangGraph)
// Genera respuestas de preview usando la arquitectura LangGraph completa
// =====================================================
// Este endpoint permite probar cómo responde el asistente
// usando el FLUJO COMPLETO de LangGraph con Tools + RAG.
// Soporta:
// - Selección de perfil (business/personal)
// - Conversaciones multi-turn
// - Simulación visual de delay configurado
// - Contexto real del tenant (Knowledge Base, servicios, etc.)
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  generatePreviewResponse,
  type PreviewRequestInput,
} from '@/src/features/ai';
import {
  checkRateLimit,
  getClientIP,
  type RateLimitConfig,
} from '@/src/shared/lib/rate-limit';
import type { ProfileType } from '@/src/shared/config/agent-templates';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// ======================
// CONFIGURATION
// ======================

/** Rate limiter for AI preview endpoint */
const previewLimiter: RateLimitConfig = {
  limit: 15, // 15 requests per minute
  windowSeconds: 60,
  identifier: 'ai-preview',
};

// ======================
// TYPES
// ======================

interface PreviewRequest {
  message: string;
  profile_type?: ProfileType;
  channel?: 'whatsapp' | 'instagram' | 'facebook' | 'webchat';
  conversation_history?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  scenario_id?: string;
}

interface PreviewResponse {
  success: boolean;
  response?: string;
  intent?: string;
  signals?: Array<{ signal: string; points: number }>;
  processing_time_ms?: number;
  model_used?: string;
  agents_used?: string[];
  tokens_used?: number;
  prompt_source?: string;
  profile_config?: {
    profile_type: ProfileType;
    response_style: string;
    template_key: string;
    delay_minutes: number;
    delay_first_only: boolean;
  };
  escalated?: boolean;
  escalation_reason?: string;
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
// MAIN HANDLER
// ======================

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // 1. Rate limiting
  const clientIP = getClientIP(request);
  const rateLimitResult = checkRateLimit(clientIP, previewLimiter);

  if (!rateLimitResult.success) {
    console.warn(`[AI Preview] Rate limit exceeded for IP: ${clientIP.slice(0, 10)}...`);
    return NextResponse.json<PreviewResponse>(
      { success: false, error: 'Demasiadas solicitudes. Intenta de nuevo en unos segundos.' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(rateLimitResult.limit),
          'X-RateLimit-Remaining': String(rateLimitResult.remaining),
          'X-RateLimit-Reset': String(rateLimitResult.resetAt),
          'Retry-After': String(Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)),
        },
      }
    );
  }

  // 2. Authentication
  const accessToken = getAccessToken(request);
  if (!accessToken) {
    return NextResponse.json<PreviewResponse>(
      { success: false, error: 'No autorizado - Token requerido' },
      { status: 401 }
    );
  }

  const supabase = createAuthenticatedClient(accessToken);
  const userContext = await getUserContext(supabase);

  if (!userContext) {
    return NextResponse.json<PreviewResponse>(
      { success: false, error: 'No autorizado - Usuario no válido' },
      { status: 401 }
    );
  }

  const { userRole } = userContext;
  const tenantId = userRole.tenant_id;

  // 3. Parse request body
  let body: PreviewRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json<PreviewResponse>(
      { success: false, error: 'Formato de request inválido' },
      { status: 400 }
    );
  }

  const {
    message,
    profile_type = 'business',
    channel = 'whatsapp',
    conversation_history = [],
  } = body;

  // Validate message
  if (!message || typeof message !== 'string') {
    return NextResponse.json<PreviewResponse>(
      { success: false, error: 'Mensaje requerido' },
      { status: 400 }
    );
  }

  const trimmedMessage = message.trim();
  if (trimmedMessage.length === 0) {
    return NextResponse.json<PreviewResponse>(
      { success: false, error: 'El mensaje no puede estar vacío' },
      { status: 400 }
    );
  }

  if (trimmedMessage.length > 2000) {
    return NextResponse.json<PreviewResponse>(
      { success: false, error: 'Mensaje demasiado largo (máx 2000 caracteres)' },
      { status: 400 }
    );
  }

  // Validate profile type
  if (!['business', 'personal'].includes(profile_type)) {
    return NextResponse.json<PreviewResponse>(
      { success: false, error: 'Tipo de perfil inválido' },
      { status: 400 }
    );
  }

  // Validate channel
  const validChannels = ['whatsapp', 'instagram', 'facebook', 'webchat'];
  if (!validChannels.includes(channel)) {
    return NextResponse.json<PreviewResponse>(
      { success: false, error: 'Canal inválido' },
      { status: 400 }
    );
  }

  // Validate conversation history length (limit to 10 messages for preview)
  if (conversation_history.length > 10) {
    return NextResponse.json<PreviewResponse>(
      { success: false, error: 'Historial de conversación muy largo (máx 10 mensajes)' },
      { status: 400 }
    );
  }

  console.log(`[AI Preview] Request - Tenant: ${tenantId}, Profile: ${profile_type}, Channel: ${channel}`);

  try {
    // 4. Generate preview using full LangGraph architecture
    const previewInput: PreviewRequestInput = {
      tenantId,
      message: trimmedMessage,
      profileType: profile_type as ProfileType,
      channel: channel as 'whatsapp' | 'instagram' | 'facebook' | 'webchat',
      conversationHistory: conversation_history,
    };

    const result = await generatePreviewResponse(previewInput);

    // 5. Log preview usage (optional, for analytics)
    // We don't save conversations for preview, but we can log metrics
    console.log(
      `[AI Preview] Complete - Profile: ${profile_type}, Intent: ${result.intent}, ` +
      `Agents: ${result.agents_used.join(' -> ')}, Time: ${result.processing_time_ms}ms`
    );

    // 6. Return response with full metadata
    return NextResponse.json<PreviewResponse>({
      success: result.success,
      response: result.response,
      intent: result.intent,
      signals: result.signals,
      processing_time_ms: result.processing_time_ms,
      model_used: result.model_used,
      agents_used: result.agents_used,
      tokens_used: result.tokens_used,
      prompt_source: result.prompt_source,
      profile_config: result.profile_config,
      escalated: result.escalated,
      escalation_reason: result.escalation_reason,
      error: result.error,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    console.error('[AI Preview] Unexpected error:', error);

    return NextResponse.json<PreviewResponse>(
      {
        success: false,
        error: errorMessage,
        processing_time_ms: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

// ======================
// GET HANDLER (Metadata)
// ======================

export async function GET(request: NextRequest) {
  // Return API metadata for debugging/documentation
  const accessToken = getAccessToken(request);
  if (!accessToken) {
    return NextResponse.json(
      { error: 'No autorizado' },
      { status: 401 }
    );
  }

  return NextResponse.json({
    api: 'AI Preview v2 (LangGraph)',
    description: 'Genera respuestas de preview usando la arquitectura LangGraph completa con Tools + RAG',
    features: [
      'Selección de perfil (business/personal)',
      'Conversaciones multi-turn',
      'Contexto real del tenant (Knowledge Base, servicios, sucursales)',
      'Detección de intent con agentes especializados',
      'Scoring de señales',
      'Simulación de delay configurable',
    ],
    endpoints: {
      POST: {
        description: 'Genera una respuesta de preview',
        body: {
          message: 'string (required) - Mensaje del cliente',
          profile_type: "'business' | 'personal' (default: 'business')",
          channel: "'whatsapp' | 'instagram' | 'facebook' | 'webchat' (default: 'whatsapp')",
          conversation_history: 'Array<{ role: "user" | "assistant", content: string }> (optional)',
        },
        response: {
          success: 'boolean',
          response: 'string - Respuesta generada',
          intent: 'string - Intent detectado',
          signals: 'Array<{ signal, points }> - Señales de scoring',
          agents_used: 'string[] - Agentes que procesaron el mensaje',
          profile_config: 'object - Configuración del perfil aplicada',
          processing_time_ms: 'number',
          tokens_used: 'number',
        },
      },
    },
    rate_limit: {
      requests_per_minute: previewLimiter.limit,
    },
  });
}

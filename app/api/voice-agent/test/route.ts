// =====================================================
// TIS TIS PLATFORM - Voice Agent Test API
// Endpoint para probar el asistente por texto sin llamada real
// =====================================================
// Este endpoint permite al usuario probar el asistente de voz
// usando texto, conectando con la misma lógica del LangGraph
// que se usa en llamadas reales pero sin VAPI.
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { VoiceTestService } from '@/src/features/voice-agent/services/voice-test.service';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// UUID validation regex (consistent with other endpoints)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL,
  'http://localhost:3000',
  'http://localhost:3001',
].filter((origin): origin is string => Boolean(origin));

/**
 * Get CORS origin for response headers
 */
function getCorsOrigin(request: NextRequest): string {
  const origin = request.headers.get('origin');
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    return origin;
  }
  return ALLOWED_ORIGINS[0] || '*';
}

/**
 * Create NextResponse with CORS headers
 */
function createCorsResponse<T>(
  request: NextRequest,
  body: T,
  init?: ResponseInit
): NextResponse<T> {
  const corsOrigin = getCorsOrigin(request);
  const response = NextResponse.json(body, init);
  response.headers.set('Access-Control-Allow-Origin', corsOrigin);
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  return response;
}

// ======================
// TYPES
// ======================

interface TestMessageRequest {
  message: string;
  conversation_history?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

interface TestMessageResponse {
  success: boolean;
  response?: string;
  latencyMs: number;
  toolsUsed?: string[];
  ragContext?: string;
  error?: string;
}

// ======================
// SUPABASE HELPERS
// ======================

/**
 * Create authenticated Supabase client using user's access token
 */
function createAuthenticatedClient(accessToken: string): SupabaseClient {
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

/**
 * Extract Bearer token from Authorization header
 */
function getAccessToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

/**
 * Get user context (user + tenant)
 */
async function getUserContext(
  supabase: SupabaseClient
): Promise<{
  userId: string;
  tenantId: string;
  role: string;
} | null> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error('[Voice Test API] Auth error:', authError?.message);
    return null;
  }

  const { data: userRole, error: roleError } = await supabase
    .from('user_roles')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .single();

  if (roleError || !userRole) {
    console.error('[Voice Test API] Role error:', roleError?.message);
    return null;
  }

  return {
    userId: user.id,
    tenantId: userRole.tenant_id,
    role: userRole.role,
  };
}

// ======================
// POST - Process test message
// ======================

/**
 * POST /api/voice-agent/test
 *
 * Procesa un mensaje de prueba y retorna la respuesta del asistente
 * usando la misma lógica que el webhook real de VAPI.
 *
 * @param request - Request con mensaje y historial opcional
 * @returns Respuesta del asistente con métricas
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<TestMessageResponse>> {
  const startTime = Date.now();

  try {
    // 1. Validar autenticación
    const accessToken = getAccessToken(request);
    if (!accessToken) {
      return createCorsResponse(
        request,
        {
          success: false,
          error: 'No autorizado - Token no proporcionado',
          latencyMs: Date.now() - startTime,
        },
        { status: 401 }
      );
    }

    // 2. Obtener contexto del usuario
    const supabase = createAuthenticatedClient(accessToken);
    const context = await getUserContext(supabase);

    if (!context) {
      return createCorsResponse(
        request,
        {
          success: false,
          error: 'No autorizado - Usuario no válido',
          latencyMs: Date.now() - startTime,
        },
        { status: 401 }
      );
    }

    // 2.1 Validar formato de tenantId
    if (!UUID_REGEX.test(context.tenantId)) {
      // No logear el tenantId inválido completo por seguridad
      console.error('[Voice Test API] Invalid tenant ID format detected');
      return createCorsResponse(
        request,
        {
          success: false,
          error: 'Tenant ID inválido',
          latencyMs: Date.now() - startTime,
        },
        { status: 400 }
      );
    }

    // Log sin exponer el tenantId completo por seguridad
    console.log('[Voice Test API] Processing request for tenant:', context.tenantId.substring(0, 8) + '...');

    // 3. Parsear body
    let body: TestMessageRequest;
    try {
      body = await request.json();
    } catch {
      return createCorsResponse(
        request,
        {
          success: false,
          error: 'Body JSON inválido',
          latencyMs: Date.now() - startTime,
        },
        { status: 400 }
      );
    }

    // 4. Validar mensaje
    const { message, conversation_history = [] } = body;

    if (!message || typeof message !== 'string' || message.trim().length < 1) {
      return createCorsResponse(
        request,
        {
          success: false,
          error: 'Mensaje requerido y debe ser un string no vacío',
          latencyMs: Date.now() - startTime,
        },
        { status: 400 }
      );
    }

    // Limitar longitud del mensaje
    if (message.length > 1000) {
      return createCorsResponse(
        request,
        {
          success: false,
          error: 'Mensaje demasiado largo (máximo 1000 caracteres)',
          latencyMs: Date.now() - startTime,
        },
        { status: 400 }
      );
    }

    // Limitar historial de conversación
    const limitedHistory = conversation_history.slice(-20); // Últimos 20 mensajes

    // 4.1 Validar formato de historial
    const isValidHistory = limitedHistory.every(
      (item) =>
        item &&
        typeof item === 'object' &&
        (item.role === 'user' || item.role === 'assistant') &&
        typeof item.content === 'string' &&
        item.content.length > 0 &&
        item.content.length <= 2000 // Limitar contenido de cada mensaje
    );

    if (!isValidHistory && limitedHistory.length > 0) {
      return createCorsResponse(
        request,
        {
          success: false,
          error: 'Formato de historial inválido',
          latencyMs: Date.now() - startTime,
        },
        { status: 400 }
      );
    }

    // 5. Procesar mensaje con el servicio
    const result = await VoiceTestService.processTestMessage({
      tenantId: context.tenantId,
      message: message.trim(),
      conversationHistory: limitedHistory,
    });

    const latencyMs = Date.now() - startTime;

    console.log(
      `[Voice Test API] Completed in ${latencyMs}ms. Success: ${!result.error}`
    );

    // 6. Retornar respuesta
    if (result.error) {
      return createCorsResponse(request, {
        success: false,
        response: result.response, // Puede tener respuesta de fallback
        error: result.error,
        latencyMs,
      });
    }

    return createCorsResponse(request, {
      success: true,
      response: result.response,
      latencyMs,
      toolsUsed: result.toolsUsed,
      ragContext: result.ragContext,
    });
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    console.error('[Voice Test API] Unexpected error:', error);

    return createCorsResponse(
      request,
      {
        success: false,
        error: 'Error interno del servidor',
        latencyMs,
      },
      { status: 500 }
    );
  }
}

// ======================
// OPTIONS - CORS preflight
// ======================

export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  const corsOrigin = getCorsOrigin(request);

  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400', // Cache preflight por 24h
    },
  });
}

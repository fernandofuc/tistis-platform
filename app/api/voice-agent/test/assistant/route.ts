// =====================================================
// TIS TIS PLATFORM - Voice Agent Test Assistant API
// Endpoint para crear/eliminar assistant temporal en VAPI
// =====================================================
// Este endpoint crea un assistant temporal para pruebas web
// usando VAPI Web SDK. El assistant usa la configuración del
// tenant y se elimina después de la prueba.
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createAssistant, deleteAssistant } from '@/src/features/voice-agent/services/vapi-api.service';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ======================
// CORS HELPERS
// ======================

const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL,
  'http://localhost:3000',
  'http://localhost:3001',
].filter(Boolean) as string[];

function getCorsOrigin(request: NextRequest): string {
  const origin = request.headers.get('origin');
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    return origin;
  }
  return ALLOWED_ORIGINS[0] || '*';
}

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

interface CreateAssistantResponse {
  success: boolean;
  assistantId?: string;
  assistantName?: string;
  firstMessage?: string;
  error?: string;
}

interface DeleteAssistantResponse {
  success: boolean;
  error?: string;
}

// ======================
// SUPABASE HELPERS
// ======================

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

function createServiceClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase credentials not configured');
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

function getAccessToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

async function getUserContext(
  supabase: SupabaseClient
): Promise<{ userId: string; tenantId: string } | null> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error('[Test Assistant API] Auth error:', authError?.message);
    return null;
  }

  const { data: userRole, error: roleError } = await supabase
    .from('user_roles')
    .select('tenant_id')
    .eq('user_id', user.id)
    .single();

  if (roleError || !userRole) {
    console.error('[Test Assistant API] Role error:', roleError?.message);
    return null;
  }

  return {
    userId: user.id,
    tenantId: userRole.tenant_id,
  };
}

// ======================
// OPTIONS - CORS Preflight
// ======================

export async function OPTIONS(request: NextRequest) {
  const corsOrigin = getCorsOrigin(request);
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400',
    },
  });
}

// ======================
// POST - Create Temporary Assistant
// ======================

/**
 * POST /api/voice-agent/test/assistant
 *
 * Crea un assistant temporal en VAPI para pruebas web.
 * Retorna el assistantId para usar con VAPI Web SDK.
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<CreateAssistantResponse>> {
  try {
    // 1. Validar autenticación
    const accessToken = getAccessToken(request);
    if (!accessToken) {
      return createCorsResponse(
        request,
        { success: false, error: 'No autorizado - Token no proporcionado' },
        { status: 401 }
      );
    }

    // 2. Obtener contexto del usuario
    const supabase = createAuthenticatedClient(accessToken);
    const context = await getUserContext(supabase);

    if (!context) {
      return createCorsResponse(
        request,
        { success: false, error: 'No autorizado - Usuario no válido' },
        { status: 401 }
      );
    }

    // 2.1 Validar formato de tenantId
    if (!UUID_REGEX.test(context.tenantId)) {
      console.error('[Test Assistant API] Invalid tenant ID format');
      return createCorsResponse(
        request,
        { success: false, error: 'Tenant ID inválido' },
        { status: 400 }
      );
    }

    // Log sin exponer tenantId completo
    console.log(
      '[Test Assistant API] Creating assistant for tenant:',
      context.tenantId.substring(0, 8) + '...'
    );

    // 3. Cargar configuración del voice agent
    const serviceSupabase = createServiceClient();

    const { data: voiceConfig, error: configError } = await serviceSupabase
      .from('voice_assistant_configs')
      .select('*')
      .eq('tenant_id', context.tenantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (configError) {
      console.error('[Test Assistant API] Config error:', configError);
      return createCorsResponse(
        request,
        { success: false, error: 'Error cargando configuración' },
        { status: 500 }
      );
    }

    if (!voiceConfig) {
      return createCorsResponse(
        request,
        { success: false, error: 'Voice agent no configurado' },
        { status: 400 }
      );
    }

    // 4. Cargar tenant para nombre y vertical
    const { data: tenant } = await serviceSupabase
      .from('tenants')
      .select('name, vertical')
      .eq('id', context.tenantId)
      .single();

    // 5. Obtener prompt compilado
    const compiledPrompt =
      voiceConfig.compiled_prompt ||
      `Eres un asistente de voz de ${tenant?.name || 'la empresa'}. Responde de forma amable y profesional.`;

    // 6. Crear assistant temporal en VAPI
    const serverUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/voice-agent/webhook`;

    const { assistant, error: vapiError } = await createAssistant({
      name: `Test - ${tenant?.name || 'Assistant'} - ${Date.now()}`,
      firstMessage:
        voiceConfig.first_message || 'Hola, ¿en qué puedo ayudarte?',
      firstMessageMode: 'assistant-speaks-first',

      // Model LLM - CRÍTICO para que funcione
      model: {
        provider: 'openai',
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: compiledPrompt,
          },
        ],
        temperature: 0.7,
        maxTokens: 500,
      },

      // Transcriber
      transcriber: {
        provider: 'deepgram',
        model: 'nova-2',
        language: 'multi',
      },

      // Voice configurada
      voice: {
        provider: '11labs',
        voiceId: voiceConfig.voice_id || 'LegCbmbXKbT5PUp3QFWv', // Javier default
        model: 'eleven_multilingual_v2',
        stability: 0.5,
        similarityBoost: 0.75,
      },

      // Server URL para tools
      serverUrl,
      serverUrlSecret: process.env.VAPI_WEBHOOK_SECRET,

      // Metadata para identificar como test
      metadata: {
        tenant_id: context.tenantId,
        is_test: 'true',
        created_at: new Date().toISOString(),
      },
    });

    if (vapiError || !assistant) {
      console.error('[Test Assistant API] VAPI error:', vapiError);
      return createCorsResponse(
        request,
        { success: false, error: 'Error creando assistant en VAPI' },
        { status: 500 }
      );
    }

    console.log(
      '[Test Assistant API] Assistant created:',
      assistant.id.substring(0, 8) + '...'
    );

    // 7. Retornar assistant ID
    return createCorsResponse(request, {
      success: true,
      assistantId: assistant.id,
      assistantName: assistant.name,
      firstMessage: assistant.firstMessage,
    });
  } catch (error) {
    console.error('[Test Assistant API] Unexpected error:', error);
    return createCorsResponse(
      request,
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// ======================
// DELETE - Remove Temporary Assistant
// ======================

/**
 * DELETE /api/voice-agent/test/assistant?id={assistantId}
 *
 * Elimina un assistant temporal de VAPI.
 */
export async function DELETE(
  request: NextRequest
): Promise<NextResponse<DeleteAssistantResponse>> {
  try {
    // 1. Obtener assistant ID
    const { searchParams } = new URL(request.url);
    const assistantId = searchParams.get('id');

    if (!assistantId) {
      return createCorsResponse(
        request,
        { success: false, error: 'ID de assistant requerido' },
        { status: 400 }
      );
    }

    // 1.1 Validar formato del assistantId (UUID o ID de VAPI)
    // VAPI IDs pueden ser UUIDs o strings alfanuméricos
    if (assistantId.length < 8 || assistantId.length > 100) {
      return createCorsResponse(
        request,
        { success: false, error: 'Formato de assistant ID inválido' },
        { status: 400 }
      );
    }

    // 2. Validar autenticación
    const accessToken = getAccessToken(request);
    if (!accessToken) {
      return createCorsResponse(
        request,
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    // 3. Verificar usuario válido
    const supabase = createAuthenticatedClient(accessToken);
    const context = await getUserContext(supabase);

    if (!context) {
      return createCorsResponse(
        request,
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Log sin exponer IDs completos
    console.log(
      '[Test Assistant API] Deleting assistant:',
      assistantId.substring(0, 8) + '...'
    );

    // 4. Eliminar de VAPI
    const { error } = await deleteAssistant(assistantId);

    if (error) {
      // No falla si no se puede eliminar (puede que ya no exista)
      console.warn('[Test Assistant API] Delete warning:', error);
    }

    return createCorsResponse(request, { success: true });
  } catch (error) {
    console.error('[Test Assistant API] Delete error:', error);
    return createCorsResponse(
      request,
      { success: false, error: 'Error interno' },
      { status: 500 }
    );
  }
}

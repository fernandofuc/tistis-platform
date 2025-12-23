// =====================================================
// TIS TIS PLATFORM - Voice Agent API
// CRUD operations for Voice Agent configuration
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  VoiceAgentService,
} from '@/src/features/voice-agent/services/voice-agent.service';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
// GET - Retrieve Voice Agent configuration
// ======================
export async function GET(request: NextRequest) {
  try {
    const accessToken = getAccessToken(request);
    if (!accessToken) {
      return NextResponse.json(
        { error: 'No autenticado - Token no proporcionado' },
        { status: 401 }
      );
    }

    const supabase = createAuthenticatedClient(accessToken);
    const context = await getUserContext(supabase);

    if (!context) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 403 }
      );
    }

    const tenantId = context.userRole.tenant_id;
    console.log('[Voice Agent API] GET - tenantId:', tenantId);

    // Verificar acceso a Voice Agent (solo Growth)
    const accessCheck = await VoiceAgentService.canAccessVoiceAgent(tenantId);
    console.log('[Voice Agent API] Access check result:', JSON.stringify(accessCheck));

    if (!accessCheck.canAccess) {
      console.log('[Voice Agent API] Access BLOCKED - reason:', accessCheck.reason, 'plan:', accessCheck.plan);
      return NextResponse.json({
        success: true,
        status: 'blocked',
        reason: accessCheck.reason,
        plan: accessCheck.plan,
        data: null,
      });
    }

    console.log('[Voice Agent API] Access GRANTED - plan:', accessCheck.plan);

    // Obtener o crear configuración
    const config = await VoiceAgentService.getOrCreateVoiceConfig(tenantId);
    const phoneNumbers = await VoiceAgentService.getPhoneNumbers(tenantId);
    const usageSummary = await VoiceAgentService.getUsageSummary(tenantId);
    const recentCalls = await VoiceAgentService.getRecentCalls(tenantId, 10);

    // Determinar estado
    let status: 'inactive' | 'configuring' | 'active' = 'inactive';
    if (config?.voice_enabled && config?.voice_status === 'active') {
      status = 'active';
    } else if (config?.voice_status === 'configuring') {
      status = 'configuring';
    }

    return NextResponse.json({
      success: true,
      status,
      plan: accessCheck.plan,
      data: {
        config,
        phone_numbers: phoneNumbers,
        usage_summary: usageSummary,
        recent_calls: recentCalls,
      },
    });
  } catch (error) {
    console.error('[Voice Agent API] GET error:', error);
    return NextResponse.json(
      { error: 'Error al obtener configuración de Voice Agent' },
      { status: 500 }
    );
  }
}

// ======================
// POST - Create/Update Voice Agent configuration
// ======================
export async function POST(request: NextRequest) {
  try {
    const accessToken = getAccessToken(request);
    if (!accessToken) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const supabase = createAuthenticatedClient(accessToken);
    const context = await getUserContext(supabase);

    if (!context) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 403 }
      );
    }

    // Solo admin/owner pueden configurar
    if (!['admin', 'owner'].includes(context.userRole.role)) {
      return NextResponse.json(
        { error: 'Solo administradores pueden configurar Voice Agent' },
        { status: 403 }
      );
    }

    const tenantId = context.userRole.tenant_id;

    // Verificar acceso
    const accessCheck = await VoiceAgentService.canAccessVoiceAgent(tenantId);
    if (!accessCheck.canAccess) {
      return NextResponse.json(
        { error: accessCheck.reason },
        { status: 403 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Body JSON inválido' },
        { status: 400 }
      );
    }

    // Obtener staff_id del usuario
    const { data: staff } = await supabase
      .from('staff')
      .select('id')
      .eq('user_id', context.user.id)
      .eq('tenant_id', tenantId)
      .single();

    // Actualizar configuración
    const updatedConfig = await VoiceAgentService.updateVoiceConfig(
      tenantId,
      body,
      staff?.id
    );

    if (!updatedConfig) {
      return NextResponse.json(
        { error: 'Error al actualizar configuración' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      config: updatedConfig,
    });
  } catch (error) {
    console.error('[Voice Agent API] POST error:', error);
    return NextResponse.json(
      { error: 'Error al actualizar Voice Agent' },
      { status: 500 }
    );
  }
}

// ======================
// PATCH - Toggle Voice Agent on/off or regenerate prompt
// ======================
export async function PATCH(request: NextRequest) {
  try {
    const accessToken = getAccessToken(request);
    if (!accessToken) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const supabase = createAuthenticatedClient(accessToken);
    const context = await getUserContext(supabase);

    if (!context) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 403 }
      );
    }

    // Solo admin/owner pueden modificar
    if (!['admin', 'owner'].includes(context.userRole.role)) {
      return NextResponse.json(
        { error: 'Solo administradores pueden modificar Voice Agent' },
        { status: 403 }
      );
    }

    const tenantId = context.userRole.tenant_id;

    // Verificar acceso
    const accessCheck = await VoiceAgentService.canAccessVoiceAgent(tenantId);
    if (!accessCheck.canAccess) {
      return NextResponse.json(
        { error: accessCheck.reason },
        { status: 403 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Body JSON inválido' },
        { status: 400 }
      );
    }

    const { action } = body;

    switch (action) {
      case 'toggle': {
        const { enabled } = body;
        if (typeof enabled !== 'boolean') {
          return NextResponse.json(
            { error: 'enabled debe ser boolean' },
            { status: 400 }
          );
        }

        const result = await VoiceAgentService.toggleVoiceAgent(tenantId, enabled);

        if (!result.success) {
          return NextResponse.json(
            { error: result.error },
            { status: 400 }
          );
        }

        return NextResponse.json({
          success: true,
          voice_enabled: enabled,
        });
      }

      case 'regenerate_prompt': {
        const prompt = await VoiceAgentService.generatePrompt(tenantId);

        if (!prompt) {
          return NextResponse.json(
            { error: 'Error al generar prompt' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          system_prompt: prompt,
        });
      }

      default:
        return NextResponse.json(
          { error: `Acción no válida: ${action}. Usa: toggle, regenerate_prompt` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Voice Agent API] PATCH error:', error);
    return NextResponse.json(
      { error: 'Error al procesar acción' },
      { status: 500 }
    );
  }
}

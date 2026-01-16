// =====================================================
// TIS TIS PLATFORM - Agent Profile Prompt API
// Obtiene el prompt generado para un perfil de agente
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PromptGeneratorService } from '@/src/features/ai/services/prompt-generator.service';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

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
// GET - Obtener prompt generado para el perfil
// ======================
export async function GET(request: NextRequest) {
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

    const tenantId = context.userRole.tenant_id;

    // Obtener profile_type de query params
    const { searchParams } = new URL(request.url);
    const profileType = searchParams.get('profile_type') || 'business';

    // Determinar el canal basado en el tipo de perfil
    // Business usa whatsapp como canal principal, Personal también
    const channel = 'whatsapp';

    // Obtener prompt cacheado
    const cachedPrompt = await PromptGeneratorService.getCachedPrompt(tenantId, channel);

    // Obtener información del perfil de agente
    const { data: agentProfile } = await supabase
      .from('agent_profiles')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('profile_type', profileType)
      .single();

    // Si no hay prompt cacheado, obtener el de ai_tenant_config
    let generatedPrompt = cachedPrompt.generated_prompt || cachedPrompt.system_prompt;
    let promptVersion = cachedPrompt.prompt_version || 0;
    let lastGenerated = cachedPrompt.last_updated || null;

    if (!generatedPrompt) {
      // Fallback: obtener de ai_tenant_config
      const { data: aiConfig } = await supabase
        .from('ai_tenant_config')
        .select('custom_instructions, updated_at')
        .eq('tenant_id', tenantId)
        .single();

      generatedPrompt = aiConfig?.custom_instructions || null;
      lastGenerated = aiConfig?.updated_at || null;
    }

    // Verificar si necesita regeneración
    const needsRegeneration = cachedPrompt.found
      ? await PromptGeneratorService.checkNeedsRegeneration(tenantId, channel)
      : true;

    // Estimar tokens del prompt
    const estimatedTokens = generatedPrompt
      ? Math.ceil(generatedPrompt.length / 4)
      : 0;

    return NextResponse.json({
      success: true,
      profile_type: profileType,
      has_prompt: !!generatedPrompt,
      prompt: generatedPrompt,
      prompt_preview: generatedPrompt
        ? generatedPrompt.substring(0, 500) + (generatedPrompt.length > 500 ? '...' : '')
        : null,
      prompt_length: generatedPrompt?.length || 0,
      estimated_tokens: estimatedTokens,
      prompt_version: promptVersion,
      last_generated: lastGenerated,
      needs_regeneration: needsRegeneration,
      agent_profile: agentProfile ? {
        profile_name: agentProfile.profile_name,
        agent_template: agentProfile.agent_template,
        response_style: agentProfile.response_style,
        is_active: agentProfile.is_active,
      } : null,
    });
  } catch (error) {
    console.error('[Agent Profile Prompt] GET Error:', error);
    return NextResponse.json(
      { error: 'Error al obtener prompt' },
      { status: 500 }
    );
  }
}

// ======================
// POST - Regenerar prompt para el perfil
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

    // Verificar permisos (solo owner y admin pueden regenerar prompts)
    if (!['owner', 'admin'].includes(context.userRole.role)) {
      return NextResponse.json(
        { error: 'Sin permisos para regenerar prompts' },
        { status: 403 }
      );
    }

    const tenantId = context.userRole.tenant_id;

    // Obtener profile_type del body
    const body = await request.json().catch(() => ({}));
    const profileType = body.profile_type || 'business';

    // Generar y cachear prompt
    console.log(`[Agent Profile Prompt] Regenerating prompt for ${profileType}...`);
    const result = await PromptGeneratorService.generateAndCachePrompt(tenantId, 'whatsapp');

    if (!result.success) {
      console.error('[Agent Profile Prompt] Error regenerating prompt:', result.error);
      return NextResponse.json(
        { error: result.error || 'Error al regenerar prompt' },
        { status: 500 }
      );
    }

    // También actualizar ai_tenant_config para compatibilidad
    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    await serviceSupabase
      .from('ai_tenant_config')
      .update({
        custom_instructions: result.prompt,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId);

    console.log(`[Agent Profile Prompt] Prompt regenerated in ${result.processingTimeMs}ms`);

    return NextResponse.json({
      success: true,
      profile_type: profileType,
      prompt: result.prompt,
      prompt_preview: result.prompt
        ? result.prompt.substring(0, 500) + (result.prompt.length > 500 ? '...' : '')
        : null,
      prompt_length: result.prompt?.length || 0,
      estimated_tokens: Math.ceil((result.prompt?.length || 0) / 4),
      generated_at: result.generatedAt,
      model: result.model,
      processing_time_ms: result.processingTimeMs,
      validation: result.validation ? {
        score: result.validation.score,
        valid: result.validation.valid,
        errors_count: result.validation.errors?.length || 0,
        warnings_count: result.validation.warnings?.length || 0,
      } : null,
    });
  } catch (error) {
    console.error('[Agent Profile Prompt] POST Error:', error);
    return NextResponse.json(
      { error: 'Error al regenerar prompt' },
      { status: 500 }
    );
  }
}

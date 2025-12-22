// =====================================================
// TIS TIS PLATFORM - Voice Agent Prompt Generation API
// Genera prompts automáticos basados en datos del tenant
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

// Create service client
function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
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
// POST - Generate voice agent prompt
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

    const tenantId = context.userRole.tenant_id;

    // Verificar que el tenant tiene plan Growth
    const serviceSupabase = createServiceClient();
    const { data: tenant } = await serviceSupabase
      .from('tenants')
      .select('plan, vertical')
      .eq('id', tenantId)
      .single();

    if (!tenant || tenant.plan !== 'growth') {
      return NextResponse.json(
        { error: 'Voice Agent solo está disponible en el plan Growth' },
        { status: 403 }
      );
    }

    // Llamar a la función SQL para generar el prompt
    const { data: generatedPrompt, error: promptError } = await serviceSupabase
      .rpc('generate_voice_agent_prompt', { p_tenant_id: tenantId });

    if (promptError) {
      console.error('[Voice Agent Generate] Error calling RPC:', promptError);
      return NextResponse.json(
        { error: 'Error al generar prompt' },
        { status: 500 }
      );
    }

    // Actualizar la configuración de voz con el nuevo prompt
    const { error: updateError } = await serviceSupabase
      .from('voice_agent_config')
      .update({
        system_prompt: generatedPrompt,
        system_prompt_generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId);

    if (updateError) {
      console.error('[Voice Agent Generate] Error updating config:', updateError);
      return NextResponse.json(
        { error: 'Error al guardar prompt' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      prompt: generatedPrompt,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Voice Agent Generate] Error:', error);
    return NextResponse.json(
      { error: 'Error al generar prompt' },
      { status: 500 }
    );
  }
}

// ======================
// GET - Get current prompt and preview of what would be generated
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
    const serviceSupabase = createServiceClient();

    // Obtener configuración actual
    const { data: config } = await serviceSupabase
      .from('voice_agent_config')
      .select('system_prompt, system_prompt_generated_at, custom_instructions')
      .eq('tenant_id', tenantId)
      .single();

    // Generar preview del prompt (sin guardar)
    const { data: previewPrompt, error: previewError } = await serviceSupabase
      .rpc('generate_voice_agent_prompt', { p_tenant_id: tenantId });

    if (previewError) {
      console.error('[Voice Agent Generate] Error generating preview:', previewError);
    }

    // Obtener contexto del tenant para mostrar qué datos se usaron
    const { data: tenantContext } = await serviceSupabase
      .rpc('get_voice_agent_context', { p_tenant_id: tenantId });

    return NextResponse.json({
      success: true,
      current_prompt: config?.system_prompt || null,
      current_prompt_generated_at: config?.system_prompt_generated_at || null,
      custom_instructions: config?.custom_instructions || null,
      preview_prompt: previewPrompt || null,
      context_summary: tenantContext ? {
        has_branches: (tenantContext.branches?.length || 0) > 0,
        branches_count: tenantContext.branches?.length || 0,
        has_services: (tenantContext.services?.length || 0) > 0,
        services_count: tenantContext.services?.length || 0,
        has_staff: (tenantContext.staff?.length || 0) > 0,
        staff_count: tenantContext.staff?.length || 0,
        vertical: tenantContext.tenant?.vertical || 'general',
        tenant_name: tenantContext.tenant?.name || 'Sin nombre',
      } : null,
    });
  } catch (error) {
    console.error('[Voice Agent Generate] GET Error:', error);
    return NextResponse.json(
      { error: 'Error al obtener prompt' },
      { status: 500 }
    );
  }
}

// =====================================================
// TIS TIS PLATFORM - Voice Agent Prompt Generation API
// Genera prompts profesionales usando Gemini 3.0
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

    // Generar prompt profesional usando Gemini 3.0
    console.log('[Voice Agent Generate] Generating prompt with Gemini 3.0...');
    const result = await PromptGeneratorService.generateVoiceAgentPrompt(tenantId);

    if (!result.success) {
      console.error('[Voice Agent Generate] Error generating prompt:', result.error);
      return NextResponse.json(
        { error: result.error || 'Error al generar prompt con IA' },
        { status: 500 }
      );
    }

    console.log(`[Voice Agent Generate] Prompt generated in ${result.processingTimeMs}ms using ${result.model}`);

    return NextResponse.json({
      success: true,
      prompt: result.prompt,
      generated_at: result.generatedAt,
      model: result.model,
      processing_time_ms: result.processingTimeMs,
    });
  } catch (error) {
    console.error('[Voice Agent Generate] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json(
      { error: 'Error al generar prompt: ' + errorMessage },
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

    // Obtener configuración actual de voice_agent_config
    const { data: config } = await serviceSupabase
      .from('voice_agent_config')
      .select('system_prompt, system_prompt_generated_at, custom_instructions')
      .eq('tenant_id', tenantId)
      .single();

    // Obtener tenant info
    const { data: tenant } = await serviceSupabase
      .from('tenants')
      .select('id, name, vertical')
      .eq('id', tenantId)
      .single();

    // Recopilar contexto del negocio usando el servicio centralizado
    console.log('[Voice Agent Generate] Calling collectBusinessContext for tenant:', tenantId);
    const businessContext = await PromptGeneratorService.collectBusinessContext(tenantId, 'voice');
    console.log('[Voice Agent Generate] BusinessContext result:', businessContext ? 'received' : 'null', {
      branches: businessContext?.branches?.length || 0,
      services: businessContext?.services?.length || 0,
      staff: businessContext?.staff?.length || 0,
    });

    // Contadores de datos de cada pestaña
    const branchesCount = businessContext?.branches?.length || 0;
    const servicesCount = businessContext?.services?.length || 0;
    const staffCount = businessContext?.staff?.length || 0;
    const faqsCount = businessContext?.faqs?.length || 0;
    const instructionsCount = businessContext?.customInstructionsList?.length || 0;
    const policiesCount = businessContext?.businessPolicies?.length || 0;
    // Knowledge Base completo
    const knowledgeArticlesCount = businessContext?.knowledgeArticles?.length || 0;
    const responseTemplatesCount = businessContext?.responseTemplates?.length || 0;
    const competitorHandlingCount = businessContext?.competitorHandling?.length || 0;

    return NextResponse.json({
      success: true,
      current_prompt: config?.system_prompt || null,
      current_prompt_generated_at: config?.system_prompt_generated_at || null,
      custom_instructions: config?.custom_instructions || null,
      context_summary: {
        // Info del tenant
        vertical: tenant?.vertical || 'general',
        tenant_name: tenant?.name || 'Sin nombre',
        // Sucursales y Staff
        has_branches: branchesCount > 0,
        branches_count: branchesCount,
        has_staff: staffCount > 0,
        staff_count: staffCount,
        // Servicios
        has_services: servicesCount > 0,
        services_count: servicesCount,
        // Base de Conocimiento (TODAS las tablas)
        has_faqs: faqsCount > 0,
        faqs_count: faqsCount,
        has_custom_instructions: instructionsCount > 0,
        custom_instructions_count: instructionsCount,
        has_policies: policiesCount > 0,
        policies_count: policiesCount,
        has_knowledge_articles: knowledgeArticlesCount > 0,
        knowledge_articles_count: knowledgeArticlesCount,
        has_response_templates: responseTemplatesCount > 0,
        response_templates_count: responseTemplatesCount,
        has_competitor_handling: competitorHandlingCount > 0,
        competitor_handling_count: competitorHandlingCount,
      },
    });
  } catch (error) {
    console.error('[Voice Agent Generate] GET Error:', error);
    return NextResponse.json(
      { error: 'Error al obtener prompt' },
      { status: 500 }
    );
  }
}

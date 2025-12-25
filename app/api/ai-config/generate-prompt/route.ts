// =====================================================
// TIS TIS PLATFORM - AI Config Prompt Generation API
// Genera y cachea prompts profesionales para mensajería
// =====================================================
// Este endpoint genera prompts UNA VEZ y los cachea.
// Los prompts solo se regeneran cuando cambian los datos
// del negocio (servicios, sucursales, FAQs, etc.)
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  PromptGeneratorService,
  type CacheChannel,
} from '@/src/features/ai/services/prompt-generator.service';

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
// POST - Generate and cache messaging agent prompts
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

    // Verificar permisos (solo owner y admin pueden generar prompts)
    if (!['owner', 'admin'].includes(context.userRole.role)) {
      return NextResponse.json(
        { error: 'Sin permisos para generar prompts' },
        { status: 403 }
      );
    }

    const tenantId = context.userRole.tenant_id;

    // Obtener canal específico del body (opcional)
    let channel: CacheChannel = 'whatsapp'; // default
    try {
      const body = await request.json();
      if (body.channel && ['whatsapp', 'instagram', 'facebook', 'tiktok', 'webchat'].includes(body.channel)) {
        channel = body.channel;
      }
    } catch {
      // Si no hay body o no es JSON válido, usar default
    }

    // Generar y cachear prompt usando el nuevo sistema
    console.log(`[AI Config Generate] Generating and caching prompt for channel ${channel}...`);
    const result = await PromptGeneratorService.generateAndCachePrompt(tenantId, channel);

    if (!result.success) {
      console.error('[AI Config Generate] Error generating prompt:', result.error);
      return NextResponse.json(
        { error: result.error || 'Error al generar prompt con IA' },
        { status: 500 }
      );
    }

    // También guardar en ai_tenant_config para compatibilidad
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

    console.log(`[AI Config Generate] Prompt generated and cached in ${result.processingTimeMs}ms using ${result.model}`);

    return NextResponse.json({
      success: true,
      prompt: result.prompt,
      generated_at: result.generatedAt,
      model: result.model,
      processing_time_ms: result.processingTimeMs,
      cached: result.model === 'cached',
      channel,
    });
  } catch (error) {
    console.error('[AI Config Generate] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json(
      { error: 'Error al generar prompt: ' + errorMessage },
      { status: 500 }
    );
  }
}

// ======================
// GET - Get context summary and cache status
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

    // Obtener canal de query params (default: whatsapp)
    const { searchParams } = new URL(request.url);
    const channel = (searchParams.get('channel') || 'whatsapp') as CacheChannel;

    // Obtener configuración actual
    const { data: config } = await supabase
      .from('ai_tenant_config')
      .select('custom_instructions, ai_personality, updated_at')
      .eq('tenant_id', tenantId)
      .single();

    // Obtener info del tenant
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id, name, vertical')
      .eq('id', tenantId)
      .single();

    // Obtener estado del caché para el canal
    const cachedPrompt = await PromptGeneratorService.getCachedPrompt(tenantId, channel);
    const needsRegeneration = cachedPrompt.found
      ? await PromptGeneratorService.checkNeedsRegeneration(tenantId, channel)
      : true;

    // Recopilar contexto del negocio
    const businessContext = await PromptGeneratorService.collectBusinessContext(tenantId, 'messaging');

    // Contadores de datos de cada pestaña
    const branchesCount = businessContext?.branches?.length || 0;
    const servicesCount = businessContext?.services?.length || 0;
    const staffCount = businessContext?.staff?.length || 0;
    const faqsCount = businessContext?.faqs?.length || 0;
    const instructionsCount = businessContext?.customInstructionsList?.length || 0;
    const policiesCount = businessContext?.businessPolicies?.length || 0;
    const knowledgeArticlesCount = businessContext?.knowledgeArticles?.length || 0;
    const responseTemplatesCount = businessContext?.responseTemplates?.length || 0;
    const competitorHandlingCount = businessContext?.competitorHandling?.length || 0;

    return NextResponse.json({
      success: true,
      current_instructions: config?.custom_instructions || null,
      current_personality: config?.ai_personality || 'professional_friendly',
      last_updated: config?.updated_at || null,
      // Información del caché
      cache_status: {
        channel,
        has_cached_prompt: cachedPrompt.found,
        cached_prompt_version: cachedPrompt.prompt_version || null,
        last_generated: cachedPrompt.last_updated || null,
        needs_regeneration: needsRegeneration,
      },
      context_summary: {
        // Pestaña: General
        vertical: tenant?.vertical || 'general',
        tenant_name: tenant?.name || 'Sin nombre',
        // Pestaña: Clínica y Sucursales
        has_branches: branchesCount > 0,
        branches_count: branchesCount,
        has_staff: staffCount > 0,
        staff_count: staffCount,
        // Pestaña: Catálogo de Servicios
        has_services: servicesCount > 0,
        services_count: servicesCount,
        // Pestaña: Base de Conocimiento (TODAS las tablas)
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
    console.error('[AI Config Generate] GET Error:', error);
    return NextResponse.json(
      { error: 'Error al obtener contexto' },
      { status: 500 }
    );
  }
}

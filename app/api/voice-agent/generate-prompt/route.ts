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
      console.log('[Voice Agent Generate] Using fallback prompt generation');

      // Generar un prompt básico manualmente cuando RPC falla
      const { data: tenantData } = await serviceSupabase
        .from('tenants')
        .select('name, vertical')
        .eq('id', tenantId)
        .single();

      const { data: branches } = await serviceSupabase
        .from('branches')
        .select('name, address, phone')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .limit(5);

      const { data: services } = await serviceSupabase
        .from('services')
        .select('name, short_description, price_min, duration_minutes')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .limit(20);

      // Generar prompt básico
      const verticalName = tenantData?.vertical === 'dental' ? 'consultorio dental' :
                          tenantData?.vertical === 'restaurant' ? 'restaurante' :
                          tenantData?.vertical === 'medical' ? 'consultorio médico' : 'negocio';

      let basicPrompt = `Eres el asistente virtual de ${tenantData?.name || 'nuestro negocio'}, un ${verticalName}.\n\n`;
      basicPrompt += `Tu objetivo principal es ayudar a los clientes a agendar citas y responder preguntas sobre nuestros servicios.\n\n`;

      if (branches && branches.length > 0) {
        basicPrompt += `SUCURSALES:\n`;
        branches.forEach(b => {
          basicPrompt += `- ${b.name}: ${b.address || 'Sin dirección'}, Tel: ${b.phone || 'Sin teléfono'}\n`;
        });
        basicPrompt += `\n`;
      }

      if (services && services.length > 0) {
        basicPrompt += `SERVICIOS DISPONIBLES:\n`;
        services.forEach(s => {
          basicPrompt += `- ${s.name}${s.price_min ? ` ($${s.price_min})` : ''}${s.duration_minutes ? ` - ${s.duration_minutes} min` : ''}\n`;
        });
        basicPrompt += `\n`;
      }

      basicPrompt += `INSTRUCCIONES:\n`;
      basicPrompt += `- Sé amable y profesional\n`;
      basicPrompt += `- Ayuda a agendar citas preguntando día, hora y servicio deseado\n`;
      basicPrompt += `- Si no sabes algo, sugiere hablar con un humano\n`;

      // Guardar el prompt básico
      await serviceSupabase
        .from('voice_agent_config')
        .update({
          system_prompt: basicPrompt,
          system_prompt_generated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId);

      return NextResponse.json({
        success: true,
        prompt: basicPrompt,
        generated_at: new Date().toISOString(),
        fallback: true,
      });
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

    // Obtener branches directamente (misma query que AI Agent Settings)
    const { data: branches } = await serviceSupabase
      .from('branches')
      .select('id, name, address, city, phone, operating_hours, is_headquarters')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('is_headquarters', { ascending: false });

    // Obtener services directamente (misma query que AI Agent Settings)
    const { data: services } = await serviceSupabase
      .from('services')
      .select('id, name, short_description, price_min, price_max, duration_minutes, category')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    // Obtener staff directamente (misma query que AI Agent Settings)
    const { data: staff } = await serviceSupabase
      .from('staff')
      .select('id, first_name, last_name, display_name, role, specialty')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .in('role', ['dentist', 'specialist', 'owner', 'manager']);

    // Filtrar staff vacío (como hace AI Agent Settings)
    const validStaff = (staff || []).filter(s =>
      (s.first_name && s.first_name.trim() !== '') ||
      (s.last_name && s.last_name.trim() !== '') ||
      (s.display_name && s.display_name.trim() !== '')
    );

    // Generar preview del prompt (sin guardar) - intentar RPC, fallback a null
    let previewPrompt = null;
    try {
      const { data: promptData } = await serviceSupabase
        .rpc('generate_voice_agent_prompt', { p_tenant_id: tenantId });
      previewPrompt = promptData;
    } catch {
      console.log('[Voice Agent Generate] RPC not available, skipping prompt preview');
    }

    const branchesCount = branches?.length || 0;
    const servicesCount = services?.length || 0;
    const staffCount = validStaff.length;

    return NextResponse.json({
      success: true,
      current_prompt: config?.system_prompt || null,
      current_prompt_generated_at: config?.system_prompt_generated_at || null,
      custom_instructions: config?.custom_instructions || null,
      preview_prompt: previewPrompt,
      context_summary: {
        has_branches: branchesCount > 0,
        branches_count: branchesCount,
        has_services: servicesCount > 0,
        services_count: servicesCount,
        has_staff: staffCount > 0,
        staff_count: staffCount,
        vertical: tenant?.vertical || 'general',
        tenant_name: tenant?.name || 'Sin nombre',
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

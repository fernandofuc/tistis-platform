// =====================================================
// TIS TIS PLATFORM - Preview Prompt API v2.0
// Generate preview of system prompts for each profile
// Arquitectura simplificada - Solo v2 (voice_assistant_configs)
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Force dynamic rendering - this API uses request headers
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Auth
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Get tenant
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('tenant_id')
      .eq('user_id', user.id)
      .single();

    if (!userRole?.tenant_id) {
      return NextResponse.json({ error: 'Sin tenant' }, { status: 403 });
    }

    // Get profile type from query
    const { searchParams } = new URL(request.url);
    const profileType = searchParams.get('profile') as 'business' | 'personal' | 'voice';

    if (!profileType || !['business', 'personal', 'voice'].includes(profileType)) {
      return NextResponse.json({ error: 'Tipo de perfil inválido' }, { status: 400 });
    }

    let prompt: string;
    let generatedAt: string | null = null;
    let profileName: string;

    if (profileType === 'voice') {
      // Get voice agent prompt from voice_assistant_configs (v2)
      const { data: voiceConfig } = await supabase
        .from('voice_assistant_configs')
        .select('compiled_prompt, compiled_prompt_at, assistant_name')
        .eq('tenant_id', userRole.tenant_id)
        .eq('is_active', true)
        .single();

      prompt = voiceConfig?.compiled_prompt || 'Prompt de voz no generado. Configura tu agente de voz para generar el prompt.';
      generatedAt = voiceConfig?.compiled_prompt_at || null;
      profileName = voiceConfig?.assistant_name || 'Agente de Voz';
    } else {
      // Get messaging agent prompt from ai_generated_prompts
      // Use 'whatsapp' as the default channel for business profile preview
      const defaultChannel = profileType === 'business' ? 'whatsapp' : 'instagram';

      const { data: generatedPrompt } = await supabase
        .from('ai_generated_prompts')
        .select('system_prompt, updated_at, tokens_estimated')
        .eq('tenant_id', userRole.tenant_id)
        .eq('channel', defaultChannel)
        .eq('status', 'active')
        .single();

      // Also get profile name from agent_profiles
      const { data: profile } = await supabase
        .from('agent_profiles')
        .select('profile_name')
        .eq('tenant_id', userRole.tenant_id)
        .eq('profile_type', profileType)
        .single();

      if (generatedPrompt?.system_prompt) {
        prompt = generatedPrompt.system_prompt;
        generatedAt = generatedPrompt.updated_at || null;
        profileName = profile?.profile_name || (profileType === 'personal' ? 'Perfil Personal' : 'Perfil Negocio');
      } else {
        // No prompt generated yet - show helpful message
        prompt = `No hay prompt generado para este perfil.

Para generar el prompt:
1. Ve a Configuración > Asistente AI
2. Configura la información de tu negocio
3. El prompt se generará automáticamente

El prompt incluirá:
- Información de tu negocio (nombre, vertical, sucursales)
- Instrucciones personalizadas de la Base de Conocimiento
- Políticas y artículos configurados
- Plantillas de respuesta
- Manejo de competencia

Tokens estimados: Se calculará al generar`;
        generatedAt = null;
        profileName = profile?.profile_name || (profileType === 'personal' ? 'Perfil Personal' : 'Perfil Negocio');
      }
    }

    // Estimate tokens (rough: ~4 chars per token)
    const tokensEstimated = Math.ceil(prompt.length / 4);

    return NextResponse.json({
      prompt,
      tokens_estimated: tokensEstimated,
      generated_at: generatedAt,
      profile_name: profileName,
    });

  } catch (error) {
    console.error('[API preview-prompt] Error:', error);
    return NextResponse.json(
      { error: 'Error al generar preview' },
      { status: 500 }
    );
  }
}

// =====================================================
// TIS TIS PLATFORM - Channel AI Configuration API
// Get/Update AI settings per channel account
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Force dynamic rendering - this API uses request headers
export const dynamic = 'force-dynamic';

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

function getAccessToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

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
// GET - Get effective AI config for a channel account
// Returns merged config (tenant defaults + channel overrides)
// ======================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const accessToken = getAccessToken(request);
    if (!accessToken) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const supabase = createAuthenticatedClient(accessToken);
    const context = await getUserContext(supabase);

    if (!context) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // Get channel connection
    const { data: channel, error: channelError } = await supabase
      .from('channel_connections')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', context.userRole.tenant_id)
      .single();

    if (channelError || !channel) {
      return NextResponse.json({ error: 'Canal no encontrado' }, { status: 404 });
    }

    // Get tenant AI config
    const { data: tenantConfig } = await supabase
      .from('ai_tenant_config')
      .select('*')
      .eq('tenant_id', context.userRole.tenant_id)
      .single();

    // Build merged config (channel overrides tenant)
    const effectiveConfig = {
      channel_id: channel.id,
      channel: channel.channel,
      account_number: channel.account_number,
      account_name: channel.account_name,
      is_personal_brand: channel.is_personal_brand || false,
      ai_enabled: channel.ai_enabled,

      // AI Personality (channel override > tenant default)
      ai_personality: channel.ai_personality_override ||
        tenantConfig?.ai_personality ||
        'professional_friendly',

      // Response delays
      first_message_delay_seconds: channel.first_message_delay_seconds ??
        tenantConfig?.default_first_message_delay ??
        0,
      subsequent_message_delay_seconds: channel.subsequent_message_delay_seconds ??
        tenantConfig?.default_subsequent_message_delay ??
        0,

      // Custom instructions
      custom_instructions: channel.custom_instructions_override ||
        tenantConfig?.custom_instructions ||
        null,

      // Use emojis
      use_emojis: tenantConfig?.use_emojis ?? false,

      // Tenant-level settings (no override at channel level)
      ai_temperature: tenantConfig?.ai_temperature ?? 0.7,
      max_tokens: tenantConfig?.max_tokens ?? 500,
      escalation_keywords: tenantConfig?.escalation_keywords || [],
      max_turns_before_escalation: tenantConfig?.max_turns_before_escalation ?? 10,
      supported_languages: tenantConfig?.supported_languages || ['es'],
      default_language: tenantConfig?.default_language || 'es',
    };

    return NextResponse.json({
      success: true,
      data: effectiveConfig,
    });
  } catch (error) {
    console.error('[Channel AI Config API] GET error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// ======================
// PUT - Update AI config for a channel account
// ======================
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const accessToken = getAccessToken(request);
    if (!accessToken) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const supabase = createAuthenticatedClient(accessToken);
    const context = await getUserContext(supabase);

    if (!context) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // Check permissions
    if (!['owner', 'admin'].includes(context.userRole.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    // Verify ownership
    const { data: existing } = await supabase
      .from('channel_connections')
      .select('id, tenant_id')
      .eq('id', id)
      .eq('tenant_id', context.userRole.tenant_id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Canal no encontrado' }, { status: 404 });
    }

    const body = await request.json();
    const {
      ai_personality_override,
      first_message_delay_seconds,
      subsequent_message_delay_seconds,
      custom_instructions_override,
      is_personal_brand,
      ai_enabled,
      account_name,
    } = body;

    // Validate personality if provided
    const validPersonalities = ['professional', 'professional_friendly', 'casual', 'formal'];
    if (ai_personality_override && !validPersonalities.includes(ai_personality_override)) {
      return NextResponse.json({ error: 'Personalidad de IA inválida' }, { status: 400 });
    }

    // Validate delays
    if (first_message_delay_seconds !== undefined) {
      if (first_message_delay_seconds < 0 || first_message_delay_seconds > 1800) {
        return NextResponse.json({
          error: 'Delay del primer mensaje debe ser entre 0 y 1800 segundos'
        }, { status: 400 });
      }
    }

    if (subsequent_message_delay_seconds !== undefined) {
      if (subsequent_message_delay_seconds < 0 || subsequent_message_delay_seconds > 300) {
        return NextResponse.json({
          error: 'Delay de mensajes subsecuentes debe ser entre 0 y 300 segundos'
        }, { status: 400 });
      }
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // Only include fields that were explicitly provided
    if (ai_personality_override !== undefined) {
      updates.ai_personality_override = ai_personality_override || null;
    }
    if (first_message_delay_seconds !== undefined) {
      updates.first_message_delay_seconds = first_message_delay_seconds;
    }
    if (subsequent_message_delay_seconds !== undefined) {
      updates.subsequent_message_delay_seconds = subsequent_message_delay_seconds;
    }
    if (custom_instructions_override !== undefined) {
      updates.custom_instructions_override = custom_instructions_override || null;
    }
    if (is_personal_brand !== undefined) {
      updates.is_personal_brand = is_personal_brand;
    }
    if (ai_enabled !== undefined) {
      updates.ai_enabled = ai_enabled;
    }
    if (account_name !== undefined) {
      updates.account_name = account_name;
    }

    const { data, error } = await supabase
      .from('channel_connections')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[Channel AI Config API] PUT error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('[Channel AI Config API] PUT error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// =====================================================
// TIS TIS PLATFORM - Loyalty Message Templates API
// CRUD for AI message templates
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

async function getUserTenantAndProgram(supabase: ReturnType<typeof createAuthenticatedClient>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: userRole } = await supabase
    .from('user_roles')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .single();

  if (!userRole) return null;

  const { data: program } = await supabase
    .from('loyalty_programs')
    .select('id')
    .eq('tenant_id', userRole.tenant_id)
    .single();

  return { userRole, program };
}

// Template types available
const TEMPLATE_TYPES = [
  'membership_reminder',      // 7 days before expiration
  'membership_expired',       // When membership expires
  'tokens_earned',            // When tokens are awarded
  'tokens_expiring',          // When tokens are about to expire
  'reward_redeemed',          // When reward is redeemed
  'tier_upgrade',             // When tier changes
  'reactivation',             // For inactive patients
  'welcome',                  // When joining program
  'birthday',                 // Birthday message with bonus
];

// ======================
// GET - Get all message templates
// ======================
export async function GET(request: NextRequest) {
  try {
    const accessToken = getAccessToken(request);
    if (!accessToken) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const supabase = createAuthenticatedClient(accessToken);
    const context = await getUserTenantAndProgram(supabase);

    if (!context?.program) {
      return NextResponse.json({ error: 'Programa no encontrado' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const templateType = searchParams.get('type');

    let query = supabase
      .from('loyalty_message_templates')
      .select('*')
      .eq('program_id', context.program.id)
      .order('template_type');

    if (templateType) {
      query = query.eq('template_type', templateType);
    }

    const { data: templates, error } = await query;

    if (error) {
      console.error('[Message Templates API] GET error:', error);
      return NextResponse.json({ error: 'Error al obtener plantillas' }, { status: 500 });
    }

    // Return with available template types for reference
    return NextResponse.json({
      success: true,
      data: templates,
      available_types: TEMPLATE_TYPES,
    });
  } catch (error) {
    console.error('[Message Templates API] GET error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// ======================
// POST - Create message template
// ======================
export async function POST(request: NextRequest) {
  try {
    const accessToken = getAccessToken(request);
    if (!accessToken) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const supabase = createAuthenticatedClient(accessToken);
    const context = await getUserTenantAndProgram(supabase);

    if (!context?.program) {
      return NextResponse.json({ error: 'Programa no encontrado' }, { status: 404 });
    }

    if (!['owner', 'admin'].includes(context.userRole.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const body = await request.json();
    const {
      template_type,
      template_name,
      subject,
      message_template,
      whatsapp_template,
      variables,
      is_active,
      send_via_whatsapp,
      send_via_email,
    } = body;

    if (!template_type || !template_name || !message_template) {
      return NextResponse.json({ error: 'Campos requeridos faltantes' }, { status: 400 });
    }

    if (!TEMPLATE_TYPES.includes(template_type)) {
      return NextResponse.json({
        error: `Tipo de plantilla inválido. Tipos válidos: ${TEMPLATE_TYPES.join(', ')}`
      }, { status: 400 });
    }

    // Check if template type already exists for this program
    const { data: existing } = await supabase
      .from('loyalty_message_templates')
      .select('id')
      .eq('program_id', context.program.id)
      .eq('template_type', template_type)
      .single();

    if (existing) {
      return NextResponse.json({
        error: 'Ya existe una plantilla para este tipo. Use PUT para actualizarla.'
      }, { status: 400 });
    }

    const { data: template, error } = await supabase
      .from('loyalty_message_templates')
      .insert({
        program_id: context.program.id,
        template_type,
        template_name,
        subject: subject || null,
        message_template,
        whatsapp_template: whatsapp_template || message_template,
        variables: variables || [],
        is_active: is_active !== false,
        send_via_whatsapp: send_via_whatsapp !== false,
        send_via_email: send_via_email || false,
      })
      .select()
      .single();

    if (error) {
      console.error('[Message Templates API] POST error:', error);
      return NextResponse.json({ error: 'Error al crear plantilla' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: template });
  } catch (error) {
    console.error('[Message Templates API] POST error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// ======================
// PUT - Update message template
// ======================
export async function PUT(request: NextRequest) {
  try {
    const accessToken = getAccessToken(request);
    if (!accessToken) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const supabase = createAuthenticatedClient(accessToken);
    const context = await getUserTenantAndProgram(supabase);

    if (!context?.program) {
      return NextResponse.json({ error: 'Programa no encontrado' }, { status: 404 });
    }

    if (!['owner', 'admin'].includes(context.userRole.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }

    // Don't allow changing template_type
    delete updateData.template_type;

    const { data: template, error } = await supabase
      .from('loyalty_message_templates')
      .update(updateData)
      .eq('id', id)
      .eq('program_id', context.program.id)
      .select()
      .single();

    if (error) {
      console.error('[Message Templates API] PUT error:', error);
      return NextResponse.json({ error: 'Error al actualizar plantilla' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: template });
  } catch (error) {
    console.error('[Message Templates API] PUT error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// ======================
// DELETE - Delete message template
// ======================
export async function DELETE(request: NextRequest) {
  try {
    const accessToken = getAccessToken(request);
    if (!accessToken) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const supabase = createAuthenticatedClient(accessToken);
    const context = await getUserTenantAndProgram(supabase);

    if (!context?.program) {
      return NextResponse.json({ error: 'Programa no encontrado' }, { status: 404 });
    }

    if (!['owner', 'admin'].includes(context.userRole.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }

    const { error } = await supabase
      .from('loyalty_message_templates')
      .delete()
      .eq('id', id)
      .eq('program_id', context.program.id);

    if (error) {
      console.error('[Message Templates API] DELETE error:', error);
      return NextResponse.json({ error: 'Error al eliminar plantilla' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Message Templates API] DELETE error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

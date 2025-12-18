// =====================================================
// TIS TIS PLATFORM - Loyalty Message Templates API
// CRUD for AI message templates
// IMPORTANT: Column mapping to DB table 'loyalty_message_templates':
//   - message_type (not template_type)
//   - name (not template_name)
//   - template_content (not message_template)
//   - channels[] (not send_via_whatsapp/send_via_email)
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

  // Get or create loyalty program
  let { data: program } = await supabase
    .from('loyalty_programs')
    .select('id')
    .eq('tenant_id', userRole.tenant_id)
    .single();

  // If no program exists, create a default one
  if (!program) {
    const { data: newProgram, error: createError } = await supabase
      .from('loyalty_programs')
      .insert({
        tenant_id: userRole.tenant_id,
        program_name: 'Programa de Lealtad',
        tokens_name: 'Punto',
        tokens_name_plural: 'Puntos',
      })
      .select('id')
      .single();

    if (createError) {
      console.error('[Message Templates API] Error creating program:', createError);
      return { userRole, program: null };
    }

    program = newProgram;
  }

  return { userRole, program };
}

// Template types available (must match DB values and frontend types)
const MESSAGE_TYPES = [
  'reactivation',             // For inactive patients
  'membership_reminder',      // X days before expiration
  'membership_expired',       // When membership expires
  'tokens_earned',            // When tokens are awarded
  'tokens_expiring',          // When tokens are about to expire
  'reward_available',         // When reward can be redeemed (alias)
  'reward_redeemed',          // When reward is redeemed
  'tier_upgrade',             // When tier level increases
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
    const messageType = searchParams.get('type');

    let query = supabase
      .from('loyalty_message_templates')
      .select('*')
      .eq('program_id', context.program.id)
      .order('message_type');

    if (messageType) {
      query = query.eq('message_type', messageType);
    }

    const { data: templates, error } = await query;

    if (error) {
      console.error('[Message Templates API] GET error:', error);
      return NextResponse.json({ error: 'Error al obtener plantillas' }, { status: 500 });
    }

    // Transform DB format to frontend format for compatibility
    const transformedTemplates = (templates || []).map(t => ({
      id: t.id,
      program_id: t.program_id,
      template_type: t.message_type, // Alias for frontend
      message_type: t.message_type,
      template_name: t.name, // Alias for frontend
      name: t.name,
      subject: t.subject,
      message_template: t.template_content, // Alias for frontend
      template_content: t.template_content,
      // Use separate whatsapp_template column if exists, otherwise fallback to template_content
      whatsapp_template: t.whatsapp_template || t.template_content,
      variables: [], // Frontend manages this locally
      send_days_before: t.send_days_before,
      send_time_preference: t.send_time_preference,
      channels: t.channels || ['whatsapp'],
      is_active: t.is_active,
      send_via_whatsapp: t.channels?.includes('whatsapp') ?? true,
      send_via_email: t.channels?.includes('email') ?? false,
      created_at: t.created_at,
      updated_at: t.updated_at,
    }));

    return NextResponse.json({
      success: true,
      data: transformedTemplates,
      available_types: MESSAGE_TYPES,
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

    // Support both old and new field names
    const messageType = body.message_type || body.template_type;
    const name = body.name || body.template_name;
    const templateContent = body.template_content || body.message_template;
    // WhatsApp template is stored separately - use its own value or fallback to main template
    const whatsappTemplate = body.whatsapp_template || templateContent;
    const subject = body.subject;
    const sendDaysBefore = body.send_days_before;
    const sendTimePreference = body.send_time_preference || 'morning';
    const isActive = body.is_active !== false;

    // Build channels array from boolean flags or use provided array
    let channels = body.channels;
    if (!channels) {
      channels = [];
      if (body.send_via_whatsapp !== false) channels.push('whatsapp');
      if (body.send_via_email === true) channels.push('email');
      if (channels.length === 0) channels = ['whatsapp']; // Default
    }

    if (!messageType || !name || !templateContent) {
      return NextResponse.json({
        error: 'Campos requeridos faltantes (message_type, name, template_content)'
      }, { status: 400 });
    }

    if (!MESSAGE_TYPES.includes(messageType)) {
      return NextResponse.json({
        error: `Tipo de mensaje inválido. Tipos válidos: ${MESSAGE_TYPES.join(', ')}`
      }, { status: 400 });
    }

    // Check if template type already exists for this program (UNIQUE constraint)
    const { data: existing } = await supabase
      .from('loyalty_message_templates')
      .select('id')
      .eq('program_id', context.program.id)
      .eq('message_type', messageType)
      .single();

    if (existing) {
      // Update existing instead of failing
      const { data: updated, error: updateError } = await supabase
        .from('loyalty_message_templates')
        .update({
          name,
          subject: subject || null,
          template_content: templateContent,
          whatsapp_template: whatsappTemplate,
          send_days_before: sendDaysBefore || null,
          send_time_preference: sendTimePreference,
          channels,
          is_active: isActive,
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (updateError) {
        console.error('[Message Templates API] UPDATE error:', updateError);
        return NextResponse.json({ error: 'Error al actualizar plantilla' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        data: transformTemplate(updated),
        message: 'Plantilla actualizada (ya existía)'
      });
    }

    const { data: template, error } = await supabase
      .from('loyalty_message_templates')
      .insert({
        program_id: context.program.id,
        message_type: messageType,
        name,
        subject: subject || null,
        template_content: templateContent,
        whatsapp_template: whatsappTemplate,
        send_days_before: sendDaysBefore || null,
        send_time_preference: sendTimePreference,
        channels,
        is_active: isActive,
      })
      .select()
      .single();

    if (error) {
      console.error('[Message Templates API] POST error:', error);
      return NextResponse.json({ error: 'Error al crear plantilla' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: transformTemplate(template) });
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
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }

    // Build update object with correct column names
    const updateData: Record<string, unknown> = {};

    if (body.name || body.template_name) {
      updateData.name = body.name || body.template_name;
    }
    if (body.subject !== undefined) {
      updateData.subject = body.subject || null;
    }
    if (body.template_content || body.message_template) {
      updateData.template_content = body.template_content || body.message_template;
    }
    // Handle whatsapp_template separately - it has its own column
    if (body.whatsapp_template !== undefined) {
      updateData.whatsapp_template = body.whatsapp_template || null;
    }
    if (body.send_days_before !== undefined) {
      updateData.send_days_before = body.send_days_before;
    }
    if (body.send_time_preference) {
      updateData.send_time_preference = body.send_time_preference;
    }
    if (body.is_active !== undefined) {
      updateData.is_active = body.is_active;
    }

    // Handle channels
    if (body.channels) {
      updateData.channels = body.channels;
    } else if (body.send_via_whatsapp !== undefined || body.send_via_email !== undefined) {
      const channels = [];
      if (body.send_via_whatsapp !== false) channels.push('whatsapp');
      if (body.send_via_email === true) channels.push('email');
      if (channels.length > 0) updateData.channels = channels;
    }

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

    return NextResponse.json({ success: true, data: transformTemplate(template) });
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

// Helper to transform DB format to frontend format
function transformTemplate(t: Record<string, unknown>) {
  return {
    id: t.id,
    program_id: t.program_id,
    template_type: t.message_type,
    message_type: t.message_type,
    template_name: t.name,
    name: t.name,
    subject: t.subject,
    message_template: t.template_content,
    template_content: t.template_content,
    // Use separate whatsapp_template column if exists, otherwise fallback to template_content
    whatsapp_template: (t.whatsapp_template as string) || (t.template_content as string),
    variables: [], // Frontend manages this locally
    send_days_before: t.send_days_before,
    send_time_preference: t.send_time_preference,
    channels: t.channels || ['whatsapp'],
    is_active: t.is_active,
    send_via_whatsapp: (t.channels as string[])?.includes('whatsapp') ?? true,
    send_via_email: (t.channels as string[])?.includes('email') ?? false,
    created_at: t.created_at,
    updated_at: t.updated_at,
  };
}

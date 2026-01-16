// =====================================================
// TIS TIS PLATFORM - Agent Profile Templates API (By ID)
// Operations on individual templates
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

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ======================
// GET - Get single template
// ======================
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
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

    const { data: template, error } = await supabase
      .from('ai_response_templates')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !template) {
      return NextResponse.json(
        { error: 'Plantilla no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      template,
    });
  } catch (error) {
    console.error('[Templates API] GET Error:', error);
    return NextResponse.json(
      { error: 'Error al obtener plantilla' },
      { status: 500 }
    );
  }
}

// ======================
// PUT - Full update template
// ======================
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
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

    if (!['owner', 'admin'].includes(context.userRole.role)) {
      return NextResponse.json(
        { error: 'Sin permisos para editar plantillas' },
        { status: 403 }
      );
    }

    const tenantId = context.userRole.tenant_id;
    const body = await request.json();

    // Validate required fields
    if (!body.trigger_type || !body.name || !body.template_text) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      );
    }

    // Validate trigger_type is a valid value
    const validTriggerTypes = [
      'greeting', 'after_hours', 'appointment_confirm', 'appointment_reminder',
      'price_inquiry', 'location_inquiry', 'doctor_inquiry', 'emergency',
      'complaint', 'thank_you', 'farewell', 'follow_up', 'promotion', 'custom'
    ];

    if (!validTriggerTypes.includes(body.trigger_type)) {
      return NextResponse.json(
        { error: 'Tipo de plantilla no válido' },
        { status: 400 }
      );
    }

    // Update template
    const { data: template, error } = await supabase
      .from('ai_response_templates')
      .update({
        trigger_type: body.trigger_type,
        name: body.name,
        template_text: body.template_text,
        variables_available: body.variables_available || [],
        is_active: body.is_active ?? true,
        branch_id: body.branch_id || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      console.error('[Templates API] Update error:', error);
      return NextResponse.json(
        { error: 'Error al actualizar plantilla' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      template,
    });
  } catch (error) {
    console.error('[Templates API] PUT Error:', error);
    return NextResponse.json(
      { error: 'Error al actualizar plantilla' },
      { status: 500 }
    );
  }
}

// ======================
// PATCH - Partial update (toggle active)
// ======================
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
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

    if (!['owner', 'admin'].includes(context.userRole.role)) {
      return NextResponse.json(
        { error: 'Sin permisos para editar plantillas' },
        { status: 403 }
      );
    }

    const tenantId = context.userRole.tenant_id;
    const body = await request.json();

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof body.is_active === 'boolean') {
      updateData.is_active = body.is_active;
    }

    // Update template
    const { data: template, error } = await supabase
      .from('ai_response_templates')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      console.error('[Templates API] Patch error:', error);
      return NextResponse.json(
        { error: 'Error al actualizar plantilla' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      template,
    });
  } catch (error) {
    console.error('[Templates API] PATCH Error:', error);
    return NextResponse.json(
      { error: 'Error al actualizar plantilla' },
      { status: 500 }
    );
  }
}

// ======================
// DELETE - Delete template
// ======================
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
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

    if (!['owner', 'admin'].includes(context.userRole.role)) {
      return NextResponse.json(
        { error: 'Sin permisos para eliminar plantillas' },
        { status: 403 }
      );
    }

    const tenantId = context.userRole.tenant_id;

    // Delete template
    const { error } = await supabase
      .from('ai_response_templates')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) {
      console.error('[Templates API] Delete error:', error);
      return NextResponse.json(
        { error: 'Error al eliminar plantilla' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      deleted: id,
    });
  } catch (error) {
    console.error('[Templates API] DELETE Error:', error);
    return NextResponse.json(
      { error: 'Error al eliminar plantilla' },
      { status: 500 }
    );
  }
}

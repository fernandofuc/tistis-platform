// =====================================================
// TIS TIS PLATFORM - Agent Profile Templates API
// CRUD operations for response templates
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

// ======================
// GET - List all templates for tenant
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

    // Fetch all templates for this tenant
    const { data: templates, error } = await supabase
      .from('ai_response_templates')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('trigger_type', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Templates API] Fetch error:', error);
      return NextResponse.json(
        { error: 'Error al obtener plantillas' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      templates: templates || [],
      total: templates?.length || 0,
    });
  } catch (error) {
    console.error('[Templates API] GET Error:', error);
    return NextResponse.json(
      { error: 'Error al obtener plantillas' },
      { status: 500 }
    );
  }
}

// ======================
// POST - Create new template
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

    // Only owner and admin can create templates
    if (!['owner', 'admin'].includes(context.userRole.role)) {
      return NextResponse.json(
        { error: 'Sin permisos para crear plantillas' },
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

    // Create template
    const { data: template, error } = await supabase
      .from('ai_response_templates')
      .insert({
        tenant_id: tenantId,
        trigger_type: body.trigger_type,
        name: body.name,
        template_text: body.template_text,
        variables_available: body.variables_available || [],
        is_active: body.is_active ?? true,
        branch_id: body.branch_id || null,
      })
      .select()
      .single();

    if (error) {
      console.error('[Templates API] Create error:', error);
      return NextResponse.json(
        { error: 'Error al crear plantilla' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      template,
    });
  } catch (error) {
    console.error('[Templates API] POST Error:', error);
    return NextResponse.json(
      { error: 'Error al crear plantilla' },
      { status: 500 }
    );
  }
}

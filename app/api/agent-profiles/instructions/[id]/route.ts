// =====================================================
// TIS TIS PLATFORM - Agent Profile Instructions API (By ID)
// Operations on individual instructions
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
// GET - Get single instruction
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

    const { data: instruction, error } = await supabase
      .from('ai_custom_instructions')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !instruction) {
      return NextResponse.json(
        { error: 'Instrucción no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      instruction,
    });
  } catch (error) {
    console.error('[Instructions API] GET Error:', error);
    return NextResponse.json(
      { error: 'Error al obtener instrucción' },
      { status: 500 }
    );
  }
}

// ======================
// PUT - Full update instruction
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
        { error: 'Sin permisos para editar instrucciones' },
        { status: 403 }
      );
    }

    const tenantId = context.userRole.tenant_id;
    const body = await request.json();

    // Validate required fields
    if (!body.instruction_type || !body.title || !body.instruction) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      );
    }

    // Check include_in_prompt limit if enabling
    if (body.include_in_prompt) {
      const { count } = await supabase
        .from('ai_custom_instructions')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('include_in_prompt', true)
        .neq('id', id);

      if (count && count >= 5) {
        return NextResponse.json(
          { error: 'Máximo 5 instrucciones pueden incluirse en el prompt' },
          { status: 400 }
        );
      }
    }

    // Update instruction
    const { data: instruction, error } = await supabase
      .from('ai_custom_instructions')
      .update({
        instruction_type: body.instruction_type,
        title: body.title,
        instruction: body.instruction,
        examples: body.examples || null,
        priority: body.priority || 0,
        include_in_prompt: body.include_in_prompt ?? true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      console.error('[Instructions API] Update error:', error);
      return NextResponse.json(
        { error: 'Error al actualizar instrucción' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      instruction,
    });
  } catch (error) {
    console.error('[Instructions API] PUT Error:', error);
    return NextResponse.json(
      { error: 'Error al actualizar instrucción' },
      { status: 500 }
    );
  }
}

// ======================
// PATCH - Partial update (toggle active, include_in_prompt)
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
        { error: 'Sin permisos para editar instrucciones' },
        { status: 403 }
      );
    }

    const tenantId = context.userRole.tenant_id;
    const body = await request.json();

    // Check include_in_prompt limit if enabling
    if (body.include_in_prompt === true) {
      const { count } = await supabase
        .from('ai_custom_instructions')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('include_in_prompt', true)
        .neq('id', id);

      if (count && count >= 5) {
        return NextResponse.json(
          { error: 'Máximo 5 instrucciones pueden incluirse en el prompt' },
          { status: 400 }
        );
      }
    }

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof body.is_active === 'boolean') {
      updateData.is_active = body.is_active;
    }
    if (typeof body.include_in_prompt === 'boolean') {
      updateData.include_in_prompt = body.include_in_prompt;
    }
    if (typeof body.priority === 'number') {
      updateData.priority = body.priority;
    }

    // Update instruction
    const { data: instruction, error } = await supabase
      .from('ai_custom_instructions')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      console.error('[Instructions API] Patch error:', error);
      return NextResponse.json(
        { error: 'Error al actualizar instrucción' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      instruction,
    });
  } catch (error) {
    console.error('[Instructions API] PATCH Error:', error);
    return NextResponse.json(
      { error: 'Error al actualizar instrucción' },
      { status: 500 }
    );
  }
}

// ======================
// DELETE - Delete instruction
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
        { error: 'Sin permisos para eliminar instrucciones' },
        { status: 403 }
      );
    }

    const tenantId = context.userRole.tenant_id;

    // Delete instruction
    const { error } = await supabase
      .from('ai_custom_instructions')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) {
      console.error('[Instructions API] Delete error:', error);
      return NextResponse.json(
        { error: 'Error al eliminar instrucción' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      deleted: id,
    });
  } catch (error) {
    console.error('[Instructions API] DELETE Error:', error);
    return NextResponse.json(
      { error: 'Error al eliminar instrucción' },
      { status: 500 }
    );
  }
}

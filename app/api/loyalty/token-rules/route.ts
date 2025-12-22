// =====================================================
// TIS TIS PLATFORM - Loyalty Token Rules API
// CRUD for token earning rules
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
      console.error('[Token Rules API] Error creating program:', createError);
      return { userRole, program: null };
    }

    program = newProgram;
  }

  return { userRole, program };
}

// ======================
// GET - Get all token rules
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

    const { data: rules, error } = await supabase
      .from('loyalty_token_rules')
      .select('*')
      .eq('program_id', context.program.id)
      .order('sort_order');

    if (error) {
      return NextResponse.json({ error: 'Error al obtener reglas' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: rules });
  } catch (error) {
    console.error('[Token Rules API] GET error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// ======================
// POST - Create token rule
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
      action_type,
      action_name,
      action_description,
      tokens_amount,
      tokens_multiplier,
      max_per_period,
      period_type,
      conditions,
      is_active,
      sort_order,
    } = body;

    if (!action_type || !action_name) {
      return NextResponse.json({ error: 'Campos requeridos faltantes' }, { status: 400 });
    }

    const { data: rule, error } = await supabase
      .from('loyalty_token_rules')
      .insert({
        program_id: context.program.id,
        action_type,
        action_name,
        action_description,
        tokens_amount: tokens_amount || 10,
        tokens_multiplier: tokens_multiplier || 1.0,
        max_per_period,
        period_type: period_type || 'month',
        conditions: conditions || {},
        is_active: is_active !== false,
        sort_order: sort_order || 0,
      })
      .select()
      .single();

    if (error) {
      console.error('[Token Rules API] POST error:', error);
      return NextResponse.json({ error: 'Error al crear regla' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: rule });
  } catch (error) {
    console.error('[Token Rules API] POST error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// ======================
// PUT - Update token rule
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

    const { data: rule, error } = await supabase
      .from('loyalty_token_rules')
      .update(updateData)
      .eq('id', id)
      .eq('program_id', context.program.id)
      .select()
      .single();

    if (error) {
      console.error('[Token Rules API] PUT error:', error);
      return NextResponse.json({ error: 'Error al actualizar regla' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: rule });
  } catch (error) {
    console.error('[Token Rules API] PUT error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// ======================
// DELETE - Delete token rule
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
      .from('loyalty_token_rules')
      .delete()
      .eq('id', id)
      .eq('program_id', context.program.id);

    if (error) {
      console.error('[Token Rules API] DELETE error:', error);
      return NextResponse.json({ error: 'Error al eliminar regla' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Token Rules API] DELETE error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

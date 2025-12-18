// =====================================================
// TIS TIS PLATFORM - Loyalty Rewards API
// CRUD for redeemable rewards
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
      console.error('[Rewards API] Error creating program:', createError);
      return { userRole, program: null };
    }

    program = newProgram;
  }

  return { userRole, program };
}

// ======================
// GET - Get all rewards
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
    const includeInactive = searchParams.get('include_inactive') === 'true';

    let query = supabase
      .from('loyalty_rewards')
      .select('*')
      .eq('program_id', context.program.id)
      .order('tokens_required');

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data: rewards, error } = await query;

    if (error) {
      console.error('[Rewards API] GET error:', error);
      return NextResponse.json({ error: 'Error al obtener recompensas' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: rewards });
  } catch (error) {
    console.error('[Rewards API] GET error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// ======================
// POST - Create reward
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
      reward_name,
      reward_description,
      reward_type,
      tokens_required,
      discount_type,
      discount_value,
      applicable_services,
      stock_limit,
      terms_conditions,
      valid_days,
      is_active,
    } = body;

    if (!reward_name || !reward_type || tokens_required === undefined) {
      return NextResponse.json({ error: 'Campos requeridos faltantes' }, { status: 400 });
    }

    // Validate reward_type
    const validTypes = ['discount_percentage', 'discount_fixed', 'free_service', 'gift', 'upgrade', 'custom'];
    if (!validTypes.includes(reward_type)) {
      return NextResponse.json({ error: 'Tipo de recompensa inválido' }, { status: 400 });
    }

    const { data: reward, error } = await supabase
      .from('loyalty_rewards')
      .insert({
        program_id: context.program.id,
        reward_name,
        reward_description,
        reward_type,
        tokens_required,
        discount_type: discount_type || null,
        discount_value: discount_value || null,
        applicable_services: applicable_services || [],
        stock_limit: stock_limit || null,
        stock_used: 0,
        terms_conditions,
        valid_days: valid_days || 30,
        is_active: is_active !== false,
      })
      .select()
      .single();

    if (error) {
      console.error('[Rewards API] POST error:', error);
      return NextResponse.json({ error: 'Error al crear recompensa' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: reward });
  } catch (error) {
    console.error('[Rewards API] POST error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// ======================
// PUT - Update reward
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

    const { data: reward, error } = await supabase
      .from('loyalty_rewards')
      .update(updateData)
      .eq('id', id)
      .eq('program_id', context.program.id)
      .select()
      .single();

    if (error) {
      console.error('[Rewards API] PUT error:', error);
      return NextResponse.json({ error: 'Error al actualizar recompensa' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: reward });
  } catch (error) {
    console.error('[Rewards API] PUT error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// ======================
// DELETE - Delete reward (soft delete via is_active)
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

    // Soft delete - mark as inactive
    const { error } = await supabase
      .from('loyalty_rewards')
      .update({ is_active: false })
      .eq('id', id)
      .eq('program_id', context.program.id);

    if (error) {
      console.error('[Rewards API] DELETE error:', error);
      return NextResponse.json({ error: 'Error al eliminar recompensa' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Rewards API] DELETE error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

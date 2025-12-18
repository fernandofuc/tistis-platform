// =====================================================
// TIS TIS PLATFORM - Loyalty Membership Plans API
// CRUD for membership subscription plans
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

// ======================
// GET - Get all membership plans
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
      .from('loyalty_membership_plans')
      .select('*')
      .eq('program_id', context.program.id)
      .order('price_monthly');

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data: plans, error } = await query;

    if (error) {
      console.error('[Membership Plans API] GET error:', error);
      return NextResponse.json({ error: 'Error al obtener planes' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: plans });
  } catch (error) {
    console.error('[Membership Plans API] GET error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// ======================
// POST - Create membership plan
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
      plan_name,
      plan_description,
      price_monthly,
      price_annual,
      benefits,
      discount_percentage,
      included_services,
      tokens_multiplier,
      priority_booking,
      stripe_monthly_price_id,
      stripe_annual_price_id,
      is_active,
      is_featured,
    } = body;

    if (!plan_name) {
      return NextResponse.json({ error: 'Nombre del plan requerido' }, { status: 400 });
    }

    if (price_monthly === undefined && price_annual === undefined) {
      return NextResponse.json({ error: 'Al menos un precio es requerido' }, { status: 400 });
    }

    const { data: plan, error } = await supabase
      .from('loyalty_membership_plans')
      .insert({
        program_id: context.program.id,
        plan_name,
        plan_description,
        price_monthly: price_monthly || null,
        price_annual: price_annual || null,
        benefits: benefits || [],
        discount_percentage: discount_percentage || 0,
        included_services: included_services || [],
        tokens_multiplier: tokens_multiplier || 1.0,
        priority_booking: priority_booking || false,
        stripe_monthly_price_id: stripe_monthly_price_id || null,
        stripe_annual_price_id: stripe_annual_price_id || null,
        is_active: is_active !== false,
        is_featured: is_featured || false,
      })
      .select()
      .single();

    if (error) {
      console.error('[Membership Plans API] POST error:', error);
      return NextResponse.json({ error: 'Error al crear plan' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: plan });
  } catch (error) {
    console.error('[Membership Plans API] POST error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// ======================
// PUT - Update membership plan
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

    const { data: plan, error } = await supabase
      .from('loyalty_membership_plans')
      .update(updateData)
      .eq('id', id)
      .eq('program_id', context.program.id)
      .select()
      .single();

    if (error) {
      console.error('[Membership Plans API] PUT error:', error);
      return NextResponse.json({ error: 'Error al actualizar plan' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: plan });
  } catch (error) {
    console.error('[Membership Plans API] PUT error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// ======================
// DELETE - Delete membership plan (soft delete)
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

    // Check if there are active memberships using this plan
    const { data: activeMemberships } = await supabase
      .from('loyalty_memberships')
      .select('id')
      .eq('plan_id', id)
      .eq('status', 'active')
      .limit(1);

    if (activeMemberships && activeMemberships.length > 0) {
      return NextResponse.json({
        error: 'No se puede eliminar un plan con membresías activas. Desactívelo primero.'
      }, { status: 400 });
    }

    // Soft delete - mark as inactive
    const { error } = await supabase
      .from('loyalty_membership_plans')
      .update({ is_active: false })
      .eq('id', id)
      .eq('program_id', context.program.id);

    if (error) {
      console.error('[Membership Plans API] DELETE error:', error);
      return NextResponse.json({ error: 'Error al eliminar plan' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Membership Plans API] DELETE error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

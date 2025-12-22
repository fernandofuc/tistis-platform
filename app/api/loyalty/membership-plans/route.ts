// =====================================================
// TIS TIS PLATFORM - Loyalty Membership Plans API
// CRUD for membership subscription plans
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
      console.error('[Membership Plans API] Error creating program:', createError);
      return { userRole, program: null };
    }

    program = newProgram;
  }

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

    if (!context) {
      console.error('[Membership Plans API] No context returned');
      return NextResponse.json({ error: 'Error de autenticación' }, { status: 401 });
    }

    if (!context.program) {
      console.error('[Membership Plans API] No program found for tenant:', context.userRole.tenant_id);
      return NextResponse.json({ error: 'Programa no encontrado. Por favor, recarga la página.' }, { status: 404 });
    }

    if (!['owner', 'admin'].includes(context.userRole.role)) {
      return NextResponse.json({ error: 'Sin permisos para crear planes' }, { status: 403 });
    }

    const body = await request.json();
    console.log('[Membership Plans API] POST body:', JSON.stringify(body));

    const {
      plan_name,
      plan_description,
      price_monthly,
      price_annual,
      benefits,
      discount_percentage, // Frontend sends this name
      discount_percent,    // Database column name
      tokens_multiplier,
      priority_booking,
      is_active,
      is_featured,
    } = body;

    if (!plan_name || plan_name.trim() === '') {
      return NextResponse.json({ error: 'Nombre del plan requerido' }, { status: 400 });
    }

    // Validate at least one price
    const monthlyPrice = price_monthly ? Number(price_monthly) : null;
    const annualPrice = price_annual ? Number(price_annual) : null;

    if (monthlyPrice === null && annualPrice === null) {
      return NextResponse.json({ error: 'Debes especificar al menos un precio (mensual o anual)' }, { status: 400 });
    }

    // Build insert data with only valid fields
    // Note: Database column is 'discount_percent', frontend may send 'discount_percentage'
    const discountValue = discount_percent ?? discount_percentage ?? 0;

    const insertData: Record<string, unknown> = {
      program_id: context.program.id,
      plan_name: plan_name.trim(),
      plan_description: plan_description?.trim() || null,
      price_monthly: monthlyPrice,
      price_annual: annualPrice,
      benefits: Array.isArray(benefits) ? benefits.filter((b: string) => b && b.trim()) : [],
      discount_percent: Number(discountValue) || 0, // Correct column name
      tokens_multiplier: Number(tokens_multiplier) || 1.0,
      priority_booking: Boolean(priority_booking),
      is_active: is_active !== false,
      is_featured: Boolean(is_featured),
    };

    console.log('[Membership Plans API] Insert data:', JSON.stringify(insertData));

    const { data: plan, error } = await supabase
      .from('loyalty_membership_plans')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('[Membership Plans API] POST error:', error);
      console.error('[Membership Plans API] Error details:', JSON.stringify(error));
      return NextResponse.json({
        error: `Error al crear plan: ${error.message || 'Error desconocido'}`,
        details: error.code
      }, { status: 500 });
    }

    console.log('[Membership Plans API] Plan created:', plan.id);
    return NextResponse.json({ success: true, data: plan });
  } catch (error) {
    console.error('[Membership Plans API] POST catch error:', error);
    return NextResponse.json({
      error: `Error interno: ${error instanceof Error ? error.message : 'Error desconocido'}`
    }, { status: 500 });
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

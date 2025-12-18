// =====================================================
// TIS TIS PLATFORM - Loyalty Memberships API
// Manage patient memberships
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
// GET - Get all memberships
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
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const status = searchParams.get('status'); // active, expired, cancelled, pending
    const leadId = searchParams.get('lead_id');

    const offset = (page - 1) * limit;

    let query = supabase
      .from('loyalty_memberships')
      .select(`
        *,
        leads (
          id,
          name,
          email,
          phone
        ),
        loyalty_membership_plans (
          plan_name,
          price_monthly,
          price_annual,
          benefits
        )
      `, { count: 'exact' })
      .eq('program_id', context.program.id)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (leadId) {
      query = query.eq('lead_id', leadId);
    }

    query = query.range(offset, offset + limit - 1);

    const { data: memberships, error, count } = await query;

    if (error) {
      console.error('[Memberships API] GET error:', error);
      return NextResponse.json({ error: 'Error al obtener membresías' }, { status: 500 });
    }

    // Get summary stats
    const { data: allMemberships } = await supabase
      .from('loyalty_memberships')
      .select('status, payment_amount')
      .eq('program_id', context.program.id);

    const summary = {
      total: allMemberships?.length || 0,
      active: 0,
      expired: 0,
      cancelled: 0,
      total_revenue: 0,
    };

    if (allMemberships) {
      allMemberships.forEach(m => {
        if (m.status === 'active') summary.active++;
        else if (m.status === 'expired') summary.expired++;
        else if (m.status === 'cancelled') summary.cancelled++;
        summary.total_revenue += m.payment_amount || 0;
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        memberships: memberships || [],
        summary,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        }
      }
    });
  } catch (error) {
    console.error('[Memberships API] GET error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// ======================
// POST - Create membership (manual or after payment)
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
      lead_id,
      plan_id,
      billing_cycle, // monthly or annual
      payment_method,
      payment_amount,
      stripe_subscription_id,
      notes,
    } = body;

    if (!lead_id || !plan_id || !billing_cycle) {
      return NextResponse.json({ error: 'Campos requeridos faltantes' }, { status: 400 });
    }

    // Verify lead belongs to this tenant
    const { data: lead } = await supabase
      .from('leads')
      .select('id')
      .eq('id', lead_id)
      .eq('tenant_id', context.userRole.tenant_id)
      .single();

    if (!lead) {
      return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 });
    }

    // Verify plan exists
    const { data: plan } = await supabase
      .from('loyalty_membership_plans')
      .select('*')
      .eq('id', plan_id)
      .eq('program_id', context.program.id)
      .eq('is_active', true)
      .single();

    if (!plan) {
      return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 });
    }

    // Check if lead already has an active membership
    const { data: existingMembership } = await supabase
      .from('loyalty_memberships')
      .select('id')
      .eq('lead_id', lead_id)
      .eq('program_id', context.program.id)
      .eq('status', 'active')
      .single();

    if (existingMembership) {
      return NextResponse.json({
        error: 'Este paciente ya tiene una membresía activa'
      }, { status: 400 });
    }

    // Calculate dates
    const startDate = new Date();
    const endDate = new Date();
    if (billing_cycle === 'annual') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    // Determine payment amount
    const amount = payment_amount || (billing_cycle === 'annual' ? plan.price_annual : plan.price_monthly);

    const { data: membership, error } = await supabase
      .from('loyalty_memberships')
      .insert({
        tenant_id: context.userRole.tenant_id,
        program_id: context.program.id,
        lead_id,
        plan_id,
        status: 'active',
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        billing_cycle,
        payment_method: payment_method || 'manual',
        payment_amount: amount,
        stripe_subscription_id: stripe_subscription_id || null,
        auto_renew: !!stripe_subscription_id,
        notes,
      })
      .select(`
        *,
        leads (name, email),
        loyalty_membership_plans (plan_name)
      `)
      .single();

    if (error) {
      console.error('[Memberships API] POST error:', error);
      return NextResponse.json({ error: 'Error al crear membresía' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: membership });
  } catch (error) {
    console.error('[Memberships API] POST error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// ======================
// PUT - Update membership status
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

    // Handle cancellation
    if (updateData.status === 'cancelled') {
      updateData.cancelled_at = new Date().toISOString();
      updateData.auto_renew = false;
    }

    const { data: membership, error } = await supabase
      .from('loyalty_memberships')
      .update(updateData)
      .eq('id', id)
      .eq('program_id', context.program.id)
      .select(`
        *,
        leads (name, email),
        loyalty_membership_plans (plan_name)
      `)
      .single();

    if (error) {
      console.error('[Memberships API] PUT error:', error);
      return NextResponse.json({ error: 'Error al actualizar membresía' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: membership });
  } catch (error) {
    console.error('[Memberships API] PUT error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// ======================
// DELETE - Cancel membership
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

    // Don't actually delete, just cancel
    const { error } = await supabase
      .from('loyalty_memberships')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        auto_renew: false,
      })
      .eq('id', id)
      .eq('program_id', context.program.id);

    if (error) {
      console.error('[Memberships API] DELETE error:', error);
      return NextResponse.json({ error: 'Error al cancelar membresía' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Memberships API] DELETE error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

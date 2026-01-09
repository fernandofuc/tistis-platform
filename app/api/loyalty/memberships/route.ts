// =====================================================
// TIS TIS PLATFORM - Loyalty Memberships API
// Manage patient memberships
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
      console.error('[Memberships API] Error creating program:', createError);
      return { userRole, program: null };
    }

    program = newProgram;
  }

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
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const status = searchParams.get('status'); // active, expired, cancelled, pending
    const leadId = searchParams.get('lead_id');

    const offset = (page - 1) * limit;

    let query = supabase
      .from('loyalty_memberships')
      .select(`
        *,
        leads (
          id,
          full_name,
          first_name,
          last_name,
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

    // Transform memberships to include computed name field for frontend compatibility
    const transformedMemberships = (memberships || []).map((m: Record<string, unknown>) => {
      const leads = m.leads as { full_name?: string; first_name?: string; last_name?: string; email?: string; phone?: string } | null;
      return {
        ...m,
        leads: leads ? {
          ...leads,
          name: leads.full_name || `${leads.first_name || ''} ${leads.last_name || ''}`.trim() || 'Sin nombre',
        } : null,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        memberships: transformedMemberships,
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

    // Verify lead belongs to this tenant and is not deleted
    const { data: lead } = await supabase
      .from('leads')
      .select('id, deleted_at')
      .eq('id', lead_id)
      .eq('tenant_id', context.userRole.tenant_id)
      .single();

    if (!lead) {
      return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 });
    }

    if (lead.deleted_at) {
      return NextResponse.json({ error: 'No se puede crear membresía para un lead eliminado' }, { status: 400 });
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

    // Check if lead already has a membership with this plan (any status)
    const { data: existingMembership } = await supabase
      .from('loyalty_memberships')
      .select('id, status')
      .eq('lead_id', lead_id)
      .eq('plan_id', plan_id)
      .single();

    if (existingMembership) {
      if (existingMembership.status === 'active') {
        return NextResponse.json({
          error: 'Este paciente ya tiene una membresía activa con este plan'
        }, { status: 400 });
      }

      // Reactivate cancelled/expired membership instead of creating new
      const reactivateEndDate = new Date();
      if (billing_cycle === 'annual') {
        reactivateEndDate.setFullYear(reactivateEndDate.getFullYear() + 1);
      } else {
        reactivateEndDate.setMonth(reactivateEndDate.getMonth() + 1);
      }

      const planPrice = billing_cycle === 'annual' ? plan.price_annual : plan.price_monthly;
      const reactivateAmount = payment_amount ?? planPrice ?? 0;

      const { data: reactivatedMembership, error: reactivateError } = await supabase
        .from('loyalty_memberships')
        .update({
          status: 'active',
          start_date: new Date().toISOString(),
          end_date: reactivateEndDate.toISOString(),
          billing_cycle,
          payment_amount: reactivateAmount,
          auto_renew: false,
          cancelled_at: null,
          cancellation_reason: null,
          metadata: {
            payment_method: payment_method || 'manual',
            notes: notes || null,
            reactivated_at: new Date().toISOString(),
          },
        })
        .eq('id', existingMembership.id)
        .select(`
          *,
          leads (full_name, first_name, last_name, email, phone),
          loyalty_membership_plans (plan_name)
        `)
        .single();

      if (reactivateError) {
        console.error('[Memberships API] Reactivation error:', reactivateError);
        return NextResponse.json({
          error: `Error al reactivar membresía: ${reactivateError.message}`
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        data: reactivatedMembership,
        reactivated: true
      });
    }

    // Calculate dates
    const startDate = new Date();
    const endDate = new Date();
    if (billing_cycle === 'annual') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    // Determine payment amount - ensure it's always a valid number
    const planPrice = billing_cycle === 'annual' ? plan.price_annual : plan.price_monthly;
    const amount = payment_amount ?? planPrice ?? 0;

    // Build insert data - only include fields that exist in the table
    const insertData: Record<string, unknown> = {
      tenant_id: context.userRole.tenant_id,
      program_id: context.program.id,
      lead_id,
      plan_id,
      status: 'active',
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      billing_cycle,
      payment_amount: amount,
      auto_renew: !!stripe_subscription_id,
    };

    // Only add stripe fields if provided
    if (stripe_subscription_id) {
      insertData.stripe_subscription_id = stripe_subscription_id;
    }

    // Store payment_method and notes in metadata since they're not columns
    if (payment_method || notes) {
      insertData.metadata = {
        payment_method: payment_method || 'manual',
        notes: notes || null,
      };
    }

    const { data: membership, error } = await supabase
      .from('loyalty_memberships')
      .insert(insertData)
      .select(`
        *,
        leads (full_name, first_name, last_name, email, phone),
        loyalty_membership_plans (plan_name)
      `)
      .single();

    if (error) {
      console.error('[Memberships API] POST error:', error);
      console.error('[Memberships API] Insert data was:', JSON.stringify(insertData));

      // Handle specific errors
      if (error.code === '23505') {
        // Unique constraint violation
        return NextResponse.json({
          error: 'Este paciente ya tiene una membresía con este plan'
        }, { status: 400 });
      }

      return NextResponse.json({
        error: `Error al crear membresía: ${error.message}`
      }, { status: 500 });
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
        leads (full_name, first_name, last_name, email, phone),
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

// =====================================================
// TIS TIS PLATFORM - Loyalty Members API
// List members with their balances and memberships
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
// GET - Get all members with loyalty info
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
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const filter = searchParams.get('filter') || 'all'; // all, with_tokens, with_membership, inactive
    const sortBy = searchParams.get('sort_by') || 'tokens'; // tokens, name, last_activity
    const sortOrder = searchParams.get('sort_order') || 'desc';

    const offset = (page - 1) * limit;

    // Get leads with their loyalty balances and memberships
    let query = supabase
      .from('leads')
      .select(`
        id,
        name,
        email,
        phone,
        last_interaction_at,
        created_at,
        loyalty_balances!left (
          current_balance,
          total_earned,
          total_spent,
          tier
        ),
        loyalty_memberships!left (
          id,
          status,
          start_date,
          end_date,
          loyalty_membership_plans (
            plan_name
          )
        )
      `, { count: 'exact' })
      .eq('tenant_id', context.userRole.tenant_id);

    // Apply search filter
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    // Apply sorting
    switch (sortBy) {
      case 'name':
        query = query.order('name', { ascending: sortOrder === 'asc' });
        break;
      case 'last_activity':
        query = query.order('last_interaction_at', { ascending: sortOrder === 'asc', nullsFirst: false });
        break;
      default:
        // Sort by tokens - we'll sort in JS since it's a joined table
        query = query.order('created_at', { ascending: false });
    }

    const { data: members, error, count } = await query;

    if (error) {
      console.error('[Members API] GET error:', error);
      return NextResponse.json({ error: 'Error al obtener miembros' }, { status: 500 });
    }

    // Transform data for frontend
    let transformedMembers = (members || []).map(member => {
      const balance = Array.isArray(member.loyalty_balances)
        ? member.loyalty_balances[0]
        : member.loyalty_balances;

      const memberships = member.loyalty_memberships as Array<{ id: string; status: string; start_date: string; end_date: string; loyalty_membership_plans: { plan_name: string } | null }> | { id: string; status: string; start_date: string; end_date: string; loyalty_membership_plans: { plan_name: string } | null } | null;
      const activeMembership = Array.isArray(memberships)
        ? memberships.find((m) => m.status === 'active')
        : memberships?.status === 'active' ? memberships : null;

      return {
        id: member.id,
        name: member.name,
        email: member.email,
        phone: member.phone,
        last_interaction_at: member.last_interaction_at,
        created_at: member.created_at,
        tokens: {
          current: balance?.current_balance || 0,
          total_earned: balance?.total_earned || 0,
          total_spent: balance?.total_spent || 0,
          tier: balance?.tier || 'bronze',
        },
        membership: activeMembership ? {
          id: activeMembership.id,
          plan_name: activeMembership.loyalty_membership_plans?.plan_name,
          status: activeMembership.status,
          expires_at: activeMembership.end_date,
        } : null,
      };
    });

    // Apply filter
    switch (filter) {
      case 'with_tokens':
        transformedMembers = transformedMembers.filter(m => m.tokens.current > 0);
        break;
      case 'with_membership':
        transformedMembers = transformedMembers.filter(m => m.membership !== null);
        break;
      case 'inactive':
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
        transformedMembers = transformedMembers.filter(m =>
          !m.last_interaction_at || new Date(m.last_interaction_at) < twelveMonthsAgo
        );
        break;
    }

    // Sort by tokens if needed (since we couldn't do it in query)
    if (sortBy === 'tokens') {
      transformedMembers.sort((a, b) => {
        const diff = b.tokens.current - a.tokens.current;
        return sortOrder === 'desc' ? diff : -diff;
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        members: transformedMembers,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        }
      }
    });
  } catch (error) {
    console.error('[Members API] GET error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// ======================
// POST - Award tokens to a member
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
    const { lead_id, tokens, description, transaction_type } = body;

    if (!lead_id || tokens === undefined) {
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

    // Use the award_loyalty_tokens function
    const { data: result, error } = await supabase.rpc('award_loyalty_tokens', {
      p_program_id: context.program.id,
      p_lead_id: lead_id,
      p_tokens: tokens,
      p_transaction_type: transaction_type || 'manual',
      p_description: description || 'Tokens otorgados manualmente',
      p_reference_id: null,
      p_reference_type: null,
    });

    if (error) {
      console.error('[Members API] POST error:', error);
      return NextResponse.json({ error: 'Error al otorgar tokens' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('[Members API] POST error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

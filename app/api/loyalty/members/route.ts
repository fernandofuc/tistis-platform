// =====================================================
// TIS TIS PLATFORM - Loyalty Members API
// List members with their balances and memberships
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  checkRateLimit,
  getClientIP,
  publicAPILimiter,
  rateLimitExceeded,
} from '@/src/shared/lib/rate-limit';

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
      console.error('[Members API] Error creating program:', createError);
      return { userRole, program: null };
    }

    program = newProgram;
  }

  return { userRole, program };
}

// ======================
// GET - Get all members with loyalty info
// Searches in BOTH leads AND patients tables
// ======================
export async function GET(request: NextRequest) {
  try {
    const accessToken = getAccessToken(request);
    if (!accessToken) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const supabase = createAuthenticatedClient(accessToken);
    const context = await getUserTenantAndProgram(supabase);

    // Allow listing leads even without a loyalty program
    // The program is only needed for loyalty-specific operations like awarding tokens
    if (!context?.userRole) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const search = searchParams.get('search') || '';
    const filter = searchParams.get('filter') || 'all'; // all, with_tokens, with_membership, inactive
    const sortBy = searchParams.get('sort_by') || 'tokens'; // tokens, name, last_activity
    const sortOrder = searchParams.get('sort_order') || 'desc';

    const offset = (page - 1) * limit;

    // =====================================================
    // QUERY 1: Get leads with their loyalty balances and memberships
    // =====================================================
    let leadsQuery = supabase
      .from('leads')
      .select(`
        id,
        full_name,
        first_name,
        last_name,
        email,
        phone,
        phone_normalized,
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

    // =====================================================
    // QUERY 2: Get patients (may or may not have linked lead)
    // =====================================================
    let patientsQuery = supabase
      .from('patients')
      .select(`
        id,
        first_name,
        last_name,
        email,
        phone,
        lead_id,
        created_at
      `, { count: 'exact' })
      .eq('tenant_id', context.userRole.tenant_id)
      .eq('status', 'active');

    // Apply search filter to BOTH queries
    if (search) {
      // Use wildcard pattern for ILIKE search
      const pattern = `*${search}*`;

      // Search in leads
      leadsQuery = leadsQuery.or(
        `full_name.ilike.${pattern},first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern},phone_normalized.ilike.${pattern}`
      );

      // Search in patients
      patientsQuery = patientsQuery.or(
        `first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`
      );

      console.log('[Members API] Search pattern:', pattern);
    }

    // Apply pagination to leads query only (we'll combine results)
    leadsQuery = leadsQuery.range(offset, offset + limit - 1);

    // Apply sorting to leads
    switch (sortBy) {
      case 'name':
        leadsQuery = leadsQuery.order('full_name', { ascending: sortOrder === 'asc' });
        patientsQuery = patientsQuery.order('first_name', { ascending: sortOrder === 'asc' });
        break;
      case 'last_activity':
        leadsQuery = leadsQuery.order('last_interaction_at', { ascending: sortOrder === 'asc', nullsFirst: false });
        patientsQuery = patientsQuery.order('created_at', { ascending: sortOrder === 'asc' });
        break;
      default:
        leadsQuery = leadsQuery.order('created_at', { ascending: false });
        patientsQuery = patientsQuery.order('created_at', { ascending: false });
    }

    // Execute both queries in parallel
    const [leadsResult, patientsResult] = await Promise.all([
      leadsQuery,
      patientsQuery
    ]);

    if (leadsResult.error) {
      console.error('[Members API] Leads query error:', leadsResult.error);
    }

    if (patientsResult.error) {
      console.error('[Members API] Patients query error:', patientsResult.error);
    }

    const leads = leadsResult.data || [];
    const patients = patientsResult.data || [];
    const leadsCount = leadsResult.count || 0;

    console.log(`[Members API] Found ${leads.length} leads, ${patients.length} patients`);

    // Create a set of lead IDs to avoid duplicates
    const leadIds = new Set(leads.map(l => l.id));
    // Also track patient lead_ids to avoid showing patients that are already leads
    const patientLeadIds = new Set(patients.filter(p => p.lead_id).map(p => p.lead_id));

    // Define member type that can be from either source
    type TransformedMember = {
      id: string;
      source: 'lead' | 'patient';
      lead_id?: string | null;
      name: string;
      email: string | null;
      phone: string | null;
      last_interaction_at: string | null;
      created_at: string;
      tokens: {
        current: number;
        total_earned: number;
        total_spent: number;
        tier: string;
      };
      membership: {
        id: string;
        plan_name: string | null;
        status: string;
        expires_at: string;
      } | null;
    };

    // Transform leads to members
    let transformedMembers: TransformedMember[] = leads.map(member => {
      const balance = Array.isArray(member.loyalty_balances)
        ? member.loyalty_balances[0]
        : member.loyalty_balances;

      // Handle memberships - can be array or single object from Supabase
      const membershipsRaw = member.loyalty_memberships as unknown;
      let activeMembership: { id: string; status: string; end_date: string; loyalty_membership_plans: unknown } | null = null;

      if (Array.isArray(membershipsRaw)) {
        activeMembership = membershipsRaw.find((m: { status: string }) => m.status === 'active') || null;
      } else if (membershipsRaw && typeof membershipsRaw === 'object' && 'status' in membershipsRaw) {
        const single = membershipsRaw as { id: string; status: string; end_date: string; loyalty_membership_plans: unknown };
        activeMembership = single.status === 'active' ? single : null;
      }

      // Extract plan name from nested relation (can also be array)
      let planName: string | null = null;
      if (activeMembership?.loyalty_membership_plans) {
        const plans = activeMembership.loyalty_membership_plans;
        if (Array.isArray(plans) && plans.length > 0) {
          planName = plans[0]?.plan_name || null;
        } else if (typeof plans === 'object' && plans !== null && 'plan_name' in plans) {
          planName = (plans as { plan_name: string }).plan_name;
        }
      }

      return {
        id: member.id,
        source: 'lead' as const,
        name: member.full_name || `${member.first_name || ''} ${member.last_name || ''}`.trim() || 'Sin nombre',
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
          plan_name: planName,
          status: activeMembership.status,
          expires_at: activeMembership.end_date,
        } : null,
      };
    });

    // Add patients that don't already have a linked lead in our results
    const patientsToAdd = patients.filter(p => {
      // Skip if this patient's lead_id is already in our leads list
      if (p.lead_id && leadIds.has(p.lead_id)) {
        return false;
      }
      return true;
    });

    const transformedPatients = patientsToAdd.map(patient => ({
      id: patient.id,
      source: 'patient' as const,
      lead_id: patient.lead_id || null, // If patient has a lead, include it
      name: `${patient.first_name || ''} ${patient.last_name || ''}`.trim() || 'Sin nombre',
      email: patient.email,
      phone: patient.phone,
      last_interaction_at: null,
      created_at: patient.created_at,
      tokens: {
        current: 0,
        total_earned: 0,
        total_spent: 0,
        tier: 'bronze',
      },
      membership: null,
    }));

    // Combine leads and patients
    transformedMembers = [...transformedMembers, ...transformedPatients];

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

    // Limit results after combining
    const limitedMembers = transformedMembers.slice(0, limit);

    return NextResponse.json({
      success: true,
      data: {
        members: limitedMembers,
        pagination: {
          page,
          limit,
          total: leadsCount + patientsToAdd.length,
          totalPages: Math.ceil((leadsCount + patientsToAdd.length) / limit),
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
  // Rate limiting: prevent flooding of token transactions (100 per minute)
  const clientIP = getClientIP(request);
  const rateLimitResult = checkRateLimit(clientIP, publicAPILimiter);

  if (!rateLimitResult.success) {
    return rateLimitExceeded(rateLimitResult);
  }

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

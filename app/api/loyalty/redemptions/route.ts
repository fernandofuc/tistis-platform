// =====================================================
// TIS TIS PLATFORM - Loyalty Redemptions API
// Handle reward redemptions
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
      console.error('[Redemptions API] Error creating program:', createError);
      return { userRole, program: null };
    }

    program = newProgram;
  }

  return { userRole, program };
}

// ======================
// GET - Get redemptions history
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
    const status = searchParams.get('status'); // pending, used, expired

    const offset = (page - 1) * limit;

    let query = supabase
      .from('loyalty_redemptions')
      .select(`
        *,
        loyalty_balances!inner (
          lead_id,
          leads (
            id,
            full_name,
            first_name,
            last_name,
            email
          )
        ),
        loyalty_rewards (
          reward_name,
          reward_type
        )
      `, { count: 'exact' })
      .eq('program_id', context.program.id)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    query = query.range(offset, offset + limit - 1);

    const { data: redemptions, error, count } = await query;

    if (error) {
      console.error('[Redemptions API] GET error:', error);
      return NextResponse.json({ error: 'Error al obtener redenciones' }, { status: 500 });
    }

    // Transform data to flatten leads from loyalty_balances and add computed name
    const transformedRedemptions = (redemptions || []).map((r: Record<string, unknown>) => {
      const leadsData = (r.loyalty_balances as Record<string, unknown>)?.leads as {
        id?: string;
        full_name?: string;
        first_name?: string;
        last_name?: string;
        email?: string;
      } | null;

      return {
        ...r,
        leads: leadsData ? {
          ...leadsData,
          name: leadsData.full_name || `${leadsData.first_name || ''} ${leadsData.last_name || ''}`.trim() || 'Sin nombre',
        } : null,
        loyalty_balances: undefined, // Remove nested structure
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        redemptions: transformedRedemptions,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        }
      }
    });
  } catch (error) {
    console.error('[Redemptions API] GET error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// ======================
// POST - Redeem a reward
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

    const body = await request.json();
    const { lead_id, reward_id, notes } = body;

    if (!lead_id || !reward_id) {
      return NextResponse.json({ error: 'Campos requeridos faltantes' }, { status: 400 });
    }

    // Verify lead belongs to this tenant and is not deleted
    const { data: leadData } = await supabase
      .from('leads')
      .select('id, full_name, first_name, last_name, deleted_at')
      .eq('id', lead_id)
      .eq('tenant_id', context.userRole.tenant_id)
      .single();

    if (!leadData) {
      return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 });
    }

    if (leadData.deleted_at) {
      return NextResponse.json({ error: 'No se pueden canjear recompensas para un lead eliminado' }, { status: 400 });
    }

    // Compute lead name for response
    const leadName = leadData.full_name || `${leadData.first_name || ''} ${leadData.last_name || ''}`.trim() || 'Sin nombre';

    // Use the atomic redeem_loyalty_reward function
    // All validations (stock, limits, balance) are done atomically with FOR UPDATE locks
    const { data: result, error } = await supabase.rpc('redeem_loyalty_reward', {
      p_tenant_id: context.userRole.tenant_id,
      p_lead_id: lead_id,
      p_reward_id: reward_id,
    });

    if (error) {
      console.error('[Redemptions API] POST error:', error);
      return NextResponse.json({ error: 'Error al canjear recompensa' }, { status: 500 });
    }

    // Check RPC result - function returns validation errors
    const redemptionResult = result?.[0];
    if (!redemptionResult?.success) {
      return NextResponse.json({
        error: redemptionResult?.error_message || 'Error al canjear recompensa'
      }, { status: 400 });
    }

    // Update notes if provided
    if (notes && redemptionResult.redemption_id) {
      await supabase
        .from('loyalty_redemptions')
        .update({ notes })
        .eq('id', redemptionResult.redemption_id);
    }

    // Get reward info for response
    const { data: reward } = await supabase
      .from('loyalty_rewards')
      .select('reward_name, tokens_required')
      .eq('id', reward_id)
      .single();

    return NextResponse.json({
      success: true,
      data: {
        redemption_id: redemptionResult.redemption_id,
        redemption_code: redemptionResult.redemption_code,
        reward_name: reward?.reward_name || 'Recompensa',
        patient_name: leadName,
        tokens_used: reward?.tokens_required || 0,
      }
    });
  } catch (error) {
    console.error('[Redemptions API] POST error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// ======================
// PUT - Mark redemption as used
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

    const body = await request.json();
    const { id, redemption_code, status: newStatus, notes } = body;

    // Can identify by id or redemption_code
    if (!id && !redemption_code) {
      return NextResponse.json({ error: 'ID o código de redención requerido' }, { status: 400 });
    }

    let query = supabase
      .from('loyalty_redemptions')
      .select('*')
      .eq('program_id', context.program.id);

    if (id) {
      query = query.eq('id', id);
    } else {
      query = query.eq('redemption_code', redemption_code);
    }

    const { data: redemption } = await query.single();

    if (!redemption) {
      return NextResponse.json({ error: 'Redención no encontrada' }, { status: 404 });
    }

    if (redemption.status === 'used') {
      return NextResponse.json({ error: 'Esta redención ya fue utilizada' }, { status: 400 });
    }

    if (redemption.status === 'expired') {
      return NextResponse.json({ error: 'Esta redención ha expirado' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {
      status: newStatus || 'used',
    };

    if (newStatus === 'used') {
      updateData.used_at = new Date().toISOString();
    }

    if (notes) {
      updateData.notes = notes;
    }

    const { data: updated, error } = await supabase
      .from('loyalty_redemptions')
      .update(updateData)
      .eq('id', redemption.id)
      .select()
      .single();

    if (error) {
      console.error('[Redemptions API] PUT error:', error);
      return NextResponse.json({ error: 'Error al actualizar redención' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('[Redemptions API] PUT error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

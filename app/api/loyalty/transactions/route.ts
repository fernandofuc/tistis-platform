// =====================================================
// TIS TIS PLATFORM - Loyalty Transactions API
// View token transaction history
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
      console.error('[Transactions API] Error creating program:', createError);
      return { userRole, program: null };
    }

    program = newProgram;
  }

  return { userRole, program };
}

// ======================
// GET - Get transactions history
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
    const leadId = searchParams.get('lead_id');
    const transactionType = searchParams.get('type');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    const offset = (page - 1) * limit;

    let query = supabase
      .from('loyalty_transactions')
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
        )
      `, { count: 'exact' })
      .eq('program_id', context.program.id)
      .order('created_at', { ascending: false });

    // Apply filters
    if (leadId) {
      query = query.eq('loyalty_balances.lead_id', leadId);
    }

    if (transactionType) {
      query = query.eq('transaction_type', transactionType);
    }

    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: transactions, error, count } = await query;

    if (error) {
      console.error('[Transactions API] GET error:', error);
      return NextResponse.json({ error: 'Error al obtener transacciones' }, { status: 500 });
    }

    // Get summary stats
    const { data: stats } = await supabase
      .from('loyalty_transactions')
      .select('tokens, transaction_type')
      .eq('program_id', context.program.id);

    const summary = {
      total_earned: 0,
      total_spent: 0,
      total_expired: 0,
    };

    if (stats) {
      stats.forEach(t => {
        if (t.tokens > 0) {
          summary.total_earned += t.tokens;
        } else if (t.transaction_type === 'expiration') {
          summary.total_expired += Math.abs(t.tokens);
        } else {
          summary.total_spent += Math.abs(t.tokens);
        }
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        transactions: transactions || [],
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
    console.error('[Transactions API] GET error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

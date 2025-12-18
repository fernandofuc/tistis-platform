// =====================================================
// TIS TIS PLATFORM - Loyalty Stats API
// Dashboard statistics for loyalty program
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
    .select('*')
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
      .select()
      .single();

    if (createError) {
      console.error('[Stats API] Error creating program:', createError);
      return { userRole, program: null };
    }

    program = newProgram;
  }

  return { userRole, program };
}

// ======================
// GET - Get dashboard statistics
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
    const period = searchParams.get('period') || '30'; // days

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    // Get all balances
    const { data: balances } = await supabase
      .from('loyalty_balances')
      .select('current_balance, total_earned, total_spent, tier')
      .eq('program_id', context.program.id);

    // Token stats
    const tokenStats = {
      total_in_circulation: 0,
      total_earned_all_time: 0,
      total_spent_all_time: 0,
      average_balance: 0,
      members_with_tokens: 0,
    };

    if (balances && balances.length > 0) {
      balances.forEach(b => {
        tokenStats.total_in_circulation += b.current_balance || 0;
        tokenStats.total_earned_all_time += b.total_earned || 0;
        tokenStats.total_spent_all_time += b.total_spent || 0;
        if (b.current_balance > 0) tokenStats.members_with_tokens++;
      });
      tokenStats.average_balance = Math.round(tokenStats.total_in_circulation / balances.length);
    }

    // Get tier distribution
    const tierDistribution = {
      bronze: 0,
      silver: 0,
      gold: 0,
      platinum: 0,
    };

    if (balances) {
      balances.forEach(b => {
        const tier = b.tier || 'bronze';
        if (tier in tierDistribution) {
          tierDistribution[tier as keyof typeof tierDistribution]++;
        }
      });
    }

    // Membership stats
    const { data: memberships } = await supabase
      .from('loyalty_memberships')
      .select('status, payment_amount, billing_cycle, created_at')
      .eq('program_id', context.program.id);

    const membershipStats = {
      total_active: 0,
      total_expired: 0,
      total_cancelled: 0,
      monthly_recurring_revenue: 0,
      annual_recurring_revenue: 0,
      new_this_period: 0,
    };

    if (memberships) {
      memberships.forEach(m => {
        if (m.status === 'active') {
          membershipStats.total_active++;
          if (m.billing_cycle === 'monthly') {
            membershipStats.monthly_recurring_revenue += m.payment_amount || 0;
          } else {
            membershipStats.annual_recurring_revenue += m.payment_amount || 0;
          }
        } else if (m.status === 'expired') {
          membershipStats.total_expired++;
        } else if (m.status === 'cancelled') {
          membershipStats.total_cancelled++;
        }

        if (new Date(m.created_at) >= startDate) {
          membershipStats.new_this_period++;
        }
      });
    }

    // Get recent transactions for period
    const { data: periodTransactions } = await supabase
      .from('loyalty_transactions')
      .select('tokens, transaction_type, created_at')
      .eq('program_id', context.program.id)
      .gte('created_at', startDate.toISOString());

    const periodStats = {
      tokens_earned: 0,
      tokens_spent: 0,
      transactions_count: periodTransactions?.length || 0,
    };

    if (periodTransactions) {
      periodTransactions.forEach(t => {
        if (t.tokens > 0) {
          periodStats.tokens_earned += t.tokens;
        } else {
          periodStats.tokens_spent += Math.abs(t.tokens);
        }
      });
    }

    // Get redemptions stats
    const { data: redemptions } = await supabase
      .from('loyalty_redemptions')
      .select('status, tokens_used, created_at')
      .eq('program_id', context.program.id);

    const redemptionStats = {
      total_redemptions: redemptions?.length || 0,
      total_all_time: redemptions?.length || 0,
      pending: 0,
      used: 0,
      expired: 0,
      total_tokens_redeemed: 0,
      redemptions_this_period: 0,
    };

    if (redemptions) {
      redemptions.forEach(r => {
        if (r.status === 'pending') redemptionStats.pending++;
        else if (r.status === 'used') redemptionStats.used++;
        else if (r.status === 'expired') redemptionStats.expired++;
        redemptionStats.total_tokens_redeemed += r.tokens_used || 0;

        if (new Date(r.created_at) >= startDate) {
          redemptionStats.redemptions_this_period++;
        }
      });
    }

    // Get top rewards
    const { data: topRewards } = await supabase
      .from('loyalty_rewards')
      .select('id, reward_name, tokens_required')
      .eq('program_id', context.program.id)
      .eq('is_active', true)
      .order('tokens_required')
      .limit(5);

    // Get rewards with redemption counts
    const rewardsWithCounts = await Promise.all(
      (topRewards || []).map(async (reward) => {
        const { count } = await supabase
          .from('loyalty_redemptions')
          .select('*', { count: 'exact', head: true })
          .eq('reward_id', reward.id);
        return { ...reward, redemption_count: count || 0 };
      })
    );

    // Get expiring memberships (next 7 days)
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const { data: expiringMemberships } = await supabase
      .from('loyalty_memberships')
      .select(`
        id,
        end_date,
        leads (full_name, first_name, last_name, email, phone),
        loyalty_membership_plans (plan_name)
      `)
      .eq('program_id', context.program.id)
      .eq('status', 'active')
      .lte('end_date', sevenDaysFromNow.toISOString())
      .order('end_date')
      .limit(10);

    // Transform expiring memberships to include computed name field
    const transformedExpiringMemberships = (expiringMemberships || []).map((m: Record<string, unknown>) => {
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
        program: {
          id: context.program.id,
          name: context.program.program_name,
          tokens_name: context.program.tokens_name,
          is_active: context.program.is_active,
        },
        tokens: tokenStats,
        tiers: tierDistribution,
        memberships: membershipStats,
        period: {
          days: parseInt(period),
          ...periodStats,
        },
        redemptions: redemptionStats,
        top_rewards: rewardsWithCounts,
        expiring_memberships: transformedExpiringMemberships,
      }
    });
  } catch (error) {
    console.error('[Stats API] GET error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

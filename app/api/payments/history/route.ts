// =====================================================
// TIS TIS PLATFORM - Payment History API
// Get payment and payout history for tenant
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ======================
// HELPERS
// ======================

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

async function getUserTenant(supabase: ReturnType<typeof createAuthenticatedClient>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: userRole } = await supabase
    .from('user_roles')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .single();

  if (!userRole) return null;

  return { userRole };
}

// ======================
// GET - Get payment history
// ======================
export async function GET(request: NextRequest) {
  try {
    const accessToken = getAccessToken(request);
    if (!accessToken) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const supabase = createAuthenticatedClient(accessToken);
    const context = await getUserTenant(supabase);

    if (!context) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'payments'; // 'payments' | 'payouts' | 'subscriptions'
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    let data = null;
    let count = 0;

    switch (type) {
      case 'payments':
        // Get payment intents
        const paymentsResult = await supabase
          .from('stripe_payment_intents')
          .select(`
            *,
            leads (full_name, first_name, last_name, email, phone),
            loyalty_memberships (
              id,
              loyalty_membership_plans (plan_name)
            )
          `, { count: 'exact' })
          .eq('tenant_id', context.userRole.tenant_id)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        data = paymentsResult.data;
        count = paymentsResult.count || 0;
        break;

      case 'payouts':
        // Only owners/admins can see payouts
        if (!['owner', 'admin'].includes(context.userRole.role)) {
          return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
        }

        const payoutsResult = await supabase
          .from('stripe_payouts')
          .select('*', { count: 'exact' })
          .eq('tenant_id', context.userRole.tenant_id)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        data = payoutsResult.data;
        count = payoutsResult.count || 0;
        break;

      case 'subscriptions':
        const subsResult = await supabase
          .from('stripe_subscriptions')
          .select(`
            *,
            leads (full_name, first_name, last_name, email, phone),
            loyalty_membership_plans (plan_name, price_monthly, price_annual)
          `, { count: 'exact' })
          .eq('tenant_id', context.userRole.tenant_id)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        data = subsResult.data;
        count = subsResult.count || 0;
        break;

      default:
        return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 });
    }

    // Transform data to include computed name field for frontend compatibility
    const transformedData = (data || []).map((item: Record<string, unknown>) => {
      const leads = item.leads as { full_name?: string; first_name?: string; last_name?: string; email?: string; phone?: string } | null;
      if (leads) {
        return {
          ...item,
          leads: {
            ...leads,
            name: leads.full_name || `${leads.first_name || ''} ${leads.last_name || ''}`.trim() || 'Sin nombre',
          },
        };
      }
      return item;
    });

    return NextResponse.json({
      success: true,
      data: transformedData,
      pagination: {
        total: count,
        limit,
        offset,
        hasMore: offset + limit < count,
      }
    });
  } catch (error) {
    console.error('[Payment History API] Error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

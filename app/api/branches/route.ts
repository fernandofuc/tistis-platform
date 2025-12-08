// =====================================================
// TIS TIS PLATFORM - Branches API Route
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/src/shared/lib/supabase';

const ESVA_TENANT_ID = process.env.NEXT_PUBLIC_ESVA_TENANT_ID || 'a0000000-0000-0000-0000-000000000001';

// ======================
// GET - Fetch branches
// ======================
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(request.url);
    const includeStats = searchParams.get('include_stats') === 'true';

    const { data: branches, error } = await supabase
      .from('branches')
      .select(`
        *,
        staff:staff(id, name, role, is_active)
      `)
      .eq('tenant_id', ESVA_TENANT_ID)
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Error fetching branches:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // If stats requested, fetch counts for each branch
    if (includeStats && branches) {
      const branchesWithStats = await Promise.all(
        branches.map(async (branch) => {
          const [leadsResult, appointmentsResult, conversationsResult] = await Promise.all([
            supabase
              .from('leads')
              .select('*', { count: 'exact', head: true })
              .eq('branch_id', branch.id),
            supabase
              .from('appointments')
              .select('*', { count: 'exact', head: true })
              .eq('branch_id', branch.id)
              .in('status', ['scheduled', 'confirmed']),
            supabase
              .from('conversations')
              .select('*', { count: 'exact', head: true })
              .eq('branch_id', branch.id)
              .eq('status', 'active'),
          ]);

          return {
            ...branch,
            stats: {
              total_leads: leadsResult.count || 0,
              pending_appointments: appointmentsResult.count || 0,
              active_conversations: conversationsResult.count || 0,
            },
          };
        })
      );

      return NextResponse.json({ data: branchesWithStats });
    }

    return NextResponse.json({ data: branches });
  } catch (error) {
    console.error('Branches API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =====================================================
// TIS TIS PLATFORM - Dashboard Stats API Route
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedContext, isAuthError, createAuthErrorResponse } from '@/src/shared/lib/auth-helper';

// ======================
// GET - Fetch dashboard statistics
// ======================
export async function GET(request: NextRequest) {
  try {
    const authContext = await getAuthenticatedContext(request);

    if (isAuthError(authContext)) {
      return createAuthErrorResponse(authContext);
    }

    const { client: supabase, tenantId } = authContext;
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branch_id');

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.toISOString();
    const todayEnd = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString();

    // Week range
    const weekStart = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Base query filters - use authenticated user's tenant
    const tenantFilter = { tenant_id: tenantId };
    const branchFilter = branchId ? { branch_id: branchId } : {};

    // ==================
    // LEADS STATS
    // ==================
    const { count: totalLeads } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .match({ ...tenantFilter, ...branchFilter });

    const { count: hotLeads } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .match({ ...tenantFilter, ...branchFilter })
      .eq('classification', 'hot');

    const { count: warmLeads } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .match({ ...tenantFilter, ...branchFilter })
      .eq('classification', 'warm');

    const { count: coldLeads } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .match({ ...tenantFilter, ...branchFilter })
      .eq('classification', 'cold');

    const { count: newLeadsToday } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .match({ ...tenantFilter, ...branchFilter })
      .gte('created_at', todayStart)
      .lt('created_at', todayEnd);

    const { count: newLeadsLastWeek } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .match({ ...tenantFilter, ...branchFilter })
      .gte('created_at', weekStart)
      .lt('created_at', todayStart);

    // ==================
    // APPOINTMENTS STATS
    // ==================
    const { count: todayAppointments } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .match({ ...tenantFilter, ...branchFilter })
      .gte('scheduled_at', todayStart)
      .lt('scheduled_at', todayEnd);

    const { count: upcomingAppointments } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .match({ ...tenantFilter, ...branchFilter })
      .gte('scheduled_at', new Date().toISOString())
      .in('status', ['scheduled', 'confirmed']);

    const { count: completedToday } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .match({ ...tenantFilter, ...branchFilter })
      .eq('status', 'completed')
      .gte('completed_at', todayStart)
      .lt('completed_at', todayEnd);

    const { count: cancelledToday } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .match({ ...tenantFilter, ...branchFilter })
      .eq('status', 'cancelled')
      .gte('cancelled_at', todayStart)
      .lt('cancelled_at', todayEnd);

    // ==================
    // CONVERSATIONS STATS
    // ==================
    const { count: activeConversations } = await supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .match({ ...tenantFilter, ...branchFilter })
      .eq('status', 'active');

    const { count: escalatedConversations } = await supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .match({ ...tenantFilter, ...branchFilter })
      .eq('status', 'escalated');

    const { count: resolvedToday } = await supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .match({ ...tenantFilter, ...branchFilter })
      .eq('status', 'resolved')
      .gte('resolved_at', todayStart)
      .lt('resolved_at', todayEnd);

    const { count: pendingConversations } = await supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .match({ ...tenantFilter, ...branchFilter })
      .eq('status', 'pending');

    // ==================
    // CALCULATE TRENDS
    // ==================
    const leadsThisWeek = (newLeadsToday || 0) + (newLeadsLastWeek || 0);
    const leadsTrend = newLeadsLastWeek
      ? Math.round(((newLeadsToday || 0) - (newLeadsLastWeek || 0) / 7) / ((newLeadsLastWeek || 1) / 7) * 100)
      : 0;

    // Build response
    const stats = {
      leads: {
        total: totalLeads || 0,
        hot: hotLeads || 0,
        warm: warmLeads || 0,
        cold: coldLeads || 0,
        new_today: newLeadsToday || 0,
        this_week: leadsThisWeek,
        trend: leadsTrend,
      },
      appointments: {
        today: todayAppointments || 0,
        upcoming: upcomingAppointments || 0,
        completed_today: completedToday || 0,
        cancelled_today: cancelledToday || 0,
      },
      conversations: {
        active: activeConversations || 0,
        escalated: escalatedConversations || 0,
        pending: pendingConversations || 0,
        resolved_today: resolvedToday || 0,
      },
    };

    return NextResponse.json({ data: stats });
  } catch (error) {
    console.error('Dashboard stats API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

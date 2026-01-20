/**
 * TIS TIS Platform - Voice Agent Realtime Metrics API
 * GET /api/voice-agent/metrics/realtime
 *
 * Returns real-time metrics like active calls and recent activity.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// =====================================================
// TYPES
// =====================================================

interface RealtimeMetrics {
  callsLastHour: number;
  activeCalls: number;
  avgLatencyLastHour: number;
  lastUpdated: string;
}

// =====================================================
// MAIN HANDLER
// =====================================================

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      // Return mock data in development
      return NextResponse.json(getMockRealtimeData());
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Calculate time range (last hour)
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    // Get calls in the last hour
    let query = supabase
      .from('voice_calls')
      .select('id, status, latency_avg_ms')
      .gte('started_at', oneHourAgo.toISOString());

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { data: recentCalls, error } = await query;

    if (error) {
      console.error('Error fetching realtime metrics:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch realtime metrics' },
        { status: 500 }
      );
    }

    // Calculate metrics
    const calls = recentCalls || [];
    const callsLastHour = calls.length;
    const activeCalls = calls.filter((c) =>
      ['initiated', 'ringing', 'in_progress'].includes(c.status)
    ).length;

    const callsWithLatency = calls.filter((c) => c.latency_avg_ms);
    const avgLatencyLastHour = callsWithLatency.length > 0
      ? callsWithLatency.reduce((sum, c) => sum + c.latency_avg_ms, 0) / callsWithLatency.length
      : 0;

    const metrics: RealtimeMetrics = {
      callsLastHour,
      activeCalls,
      avgLatencyLastHour: Math.round(avgLatencyLastHour),
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      ...metrics,
    });
  } catch (error) {
    console.error('Realtime metrics API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =====================================================
// MOCK DATA (for development)
// =====================================================

function getMockRealtimeData() {
  return {
    success: true,
    callsLastHour: Math.floor(5 + Math.random() * 15),
    activeCalls: Math.floor(Math.random() * 3),
    avgLatencyLastHour: Math.floor(250 + Math.random() * 150),
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * TIS TIS Platform - Voice Agent Metrics API
 * GET /api/voice-agent/metrics
 *
 * Returns dashboard metrics, charts data, and outcome distribution
 * for the specified date range.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';
import type {
  DashboardMetrics,
  CallsByDay,
  LatencyDataPoint,
  OutcomeDistribution,
} from '@/components/voice-agent/dashboard/types';
import {
  OUTCOME_LABELS,
  OUTCOME_COLORS,
} from '@/components/voice-agent/dashboard/types';

// =====================================================
// TYPES
// =====================================================

/**
 * Voice call record from database
 */
interface VoiceCallRecord {
  id: string;
  started_at: string;
  status: string;
  outcome?: string;
  duration_seconds?: number;
  latency_avg_ms?: number;
  cost_usd?: number;
  escalated?: boolean;
}

function formatDisplayDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

function calculateChange(current: number, previous: number): { changePercent: number; changeIsPositive: boolean } {
  if (previous === 0) {
    return { changePercent: current > 0 ? 100 : 0, changeIsPositive: current >= 0 };
  }
  const changePercent = ((current - previous) / previous) * 100;
  return { changePercent, changeIsPositive: changePercent >= 0 };
}

// =====================================================
// MAIN HANDLER
// =====================================================

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const tenantId = searchParams.get('tenantId');

    // Validate required params
    if (!startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: 'startDate and endDate are required' },
        { status: 400 }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      // Return mock data in development
      return NextResponse.json(getMockData(startDate, endDate));
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Calculate previous period for comparison
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    const periodDays = Math.ceil((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24));

    const prevEndDate = new Date(startDateObj);
    prevEndDate.setDate(prevEndDate.getDate() - 1);
    const prevStartDate = new Date(prevEndDate);
    prevStartDate.setDate(prevStartDate.getDate() - periodDays);

    // Build query
    let query = supabase
      .from('voice_calls')
      .select('*')
      .gte('started_at', startDate)
      .lte('started_at', endDate + 'T23:59:59');

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { data: calls, error: callsError } = await query;

    if (callsError) {
      console.error('Error fetching calls:', callsError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch calls data' },
        { status: 500 }
      );
    }

    // Get previous period calls for comparison
    let prevQuery = supabase
      .from('voice_calls')
      .select('*')
      .gte('started_at', prevStartDate.toISOString().split('T')[0])
      .lte('started_at', prevEndDate.toISOString().split('T')[0] + 'T23:59:59');

    if (tenantId) {
      prevQuery = prevQuery.eq('tenant_id', tenantId);
    }

    const { data: prevCalls } = await prevQuery;

    // Calculate metrics
    const metrics = calculateMetrics(calls || [], prevCalls || []);
    const callsByDay = aggregateCallsByDay(calls || [], startDate, endDate);
    const latencyByDay = aggregateLatencyByDay(calls || [], startDate, endDate);
    const outcomeDistribution = calculateOutcomeDistribution(calls || []);

    return NextResponse.json({
      success: true,
      metrics,
      callsByDay,
      latencyByDay,
      outcomeDistribution,
      dateRange: { startDate, endDate },
    });
  } catch (error) {
    console.error('Metrics API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =====================================================
// DATA PROCESSING
// =====================================================

function calculateMetrics(calls: VoiceCallRecord[], prevCalls: VoiceCallRecord[]): DashboardMetrics {
  // Current period
  const totalCalls = calls.length;
  const completedCalls = calls.filter((c) => c.status === 'completed').length;
  const successRate = totalCalls > 0 ? (completedCalls / totalCalls) * 100 : 0;
  const avgDuration = totalCalls > 0
    ? calls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / totalCalls
    : 0;
  const callsWithLatency = calls.filter((c) => c.latency_avg_ms != null);
  const avgLatency = callsWithLatency.length > 0
    ? callsWithLatency.reduce((sum, c) => sum + (c.latency_avg_ms ?? 0), 0) / callsWithLatency.length
    : 0;
  const bookedCalls = calls.filter((c) => c.outcome === 'appointment_booked').length;
  const bookingRate = totalCalls > 0 ? (bookedCalls / totalCalls) * 100 : 0;
  const escalatedCalls = calls.filter((c) => c.escalated).length;
  const escalationRate = totalCalls > 0 ? (escalatedCalls / totalCalls) * 100 : 0;
  const totalCost = calls.reduce((sum, c) => sum + (c.cost_usd || 0), 0);

  // Previous period
  const prevTotalCalls = prevCalls.length;
  const prevCompletedCalls = prevCalls.filter((c) => c.status === 'completed').length;
  const prevSuccessRate = prevTotalCalls > 0 ? (prevCompletedCalls / prevTotalCalls) * 100 : 0;
  const prevAvgDuration = prevTotalCalls > 0
    ? prevCalls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / prevTotalCalls
    : 0;
  const prevCallsWithLatency = prevCalls.filter((c) => c.latency_avg_ms != null);
  const prevAvgLatency = prevCallsWithLatency.length > 0
    ? prevCallsWithLatency.reduce((sum, c) => sum + (c.latency_avg_ms ?? 0), 0) / prevCallsWithLatency.length
    : 0;

  return {
    totalCalls: {
      value: totalCalls,
      previousValue: prevTotalCalls,
      ...calculateChange(totalCalls, prevTotalCalls),
    },
    successRate: {
      value: successRate,
      previousValue: prevSuccessRate,
      ...calculateChange(successRate, prevSuccessRate),
    },
    avgDuration: {
      value: avgDuration,
      previousValue: prevAvgDuration,
      ...calculateChange(avgDuration, prevAvgDuration),
      changeIsPositive: avgDuration <= prevAvgDuration, // Lower is better
    },
    avgLatency: {
      value: avgLatency,
      previousValue: prevAvgLatency,
      ...calculateChange(avgLatency, prevAvgLatency),
      changeIsPositive: avgLatency <= prevAvgLatency, // Lower is better
    },
    bookingRate: {
      value: bookingRate,
      ...calculateChange(bookingRate, 0),
    },
    escalationRate: {
      value: escalationRate,
      ...calculateChange(escalationRate, 0),
      changeIsPositive: escalationRate <= 10, // Lower is generally better
    },
    totalCost: {
      value: totalCost,
    },
  };
}

function aggregateCallsByDay(calls: VoiceCallRecord[], startDate: string, endDate: string): CallsByDay[] {
  // Create date range
  const result: Map<string, CallsByDay> = new Map();

  const currentDate = new Date(startDate);
  const endDateObj = new Date(endDate);

  while (currentDate <= endDateObj) {
    const dateStr = currentDate.toISOString().split('T')[0];
    result.set(dateStr, {
      date: dateStr,
      displayDate: formatDisplayDate(dateStr),
      total: 0,
      completed: 0,
      failed: 0,
      escalated: 0,
    });
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Aggregate calls
  for (const call of calls) {
    if (!call.started_at) continue;
    const dateStr = call.started_at.split('T')[0];
    const day = result.get(dateStr);
    if (day) {
      day.total++;
      if (call.status === 'completed') day.completed++;
      if (call.status === 'failed') day.failed++;
      if (call.escalated) day.escalated++;
    }
  }

  return Array.from(result.values());
}

function aggregateLatencyByDay(calls: VoiceCallRecord[], startDate: string, endDate: string): LatencyDataPoint[] {
  // Group calls by day
  const byDay: Map<string, number[]> = new Map();

  const currentDate = new Date(startDate);
  const endDateObj = new Date(endDate);

  while (currentDate <= endDateObj) {
    const dateStr = currentDate.toISOString().split('T')[0];
    byDay.set(dateStr, []);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  for (const call of calls) {
    if (!call.started_at || !call.latency_avg_ms) continue;
    const dateStr = call.started_at.split('T')[0];
    const latencies = byDay.get(dateStr);
    if (latencies) {
      latencies.push(call.latency_avg_ms);
    }
  }

  // Calculate percentiles
  return Array.from(byDay.entries()).map(([date, latencies]) => {
    const sorted = [...latencies].sort((a, b) => a - b);
    const avg = latencies.length > 0
      ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length
      : 0;
    const p50 = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.5)] : 0;
    const p95 = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.95)] : 0;

    return {
      date,
      displayDate: formatDisplayDate(date),
      avg,
      p50,
      p95,
    };
  });
}

function calculateOutcomeDistribution(calls: VoiceCallRecord[]): OutcomeDistribution[] {
  const counts: Map<string, number> = new Map();

  for (const call of calls) {
    if (call.outcome) {
      counts.set(call.outcome, (counts.get(call.outcome) || 0) + 1);
    }
  }

  const total = Array.from(counts.values()).reduce((sum, c) => sum + c, 0);

  return Array.from(counts.entries())
    .map(([outcome, count]) => ({
      outcome: outcome as OutcomeDistribution['outcome'],
      label: OUTCOME_LABELS[outcome as keyof typeof OUTCOME_LABELS] || outcome,
      count,
      percent: total > 0 ? (count / total) * 100 : 0,
      color: OUTCOME_COLORS[outcome as keyof typeof OUTCOME_COLORS] || '#94a3b8',
    }))
    .sort((a, b) => b.count - a.count);
}

// =====================================================
// MOCK DATA (for development)
// =====================================================

function getMockData(startDate: string, endDate: string) {
  const callsByDay: CallsByDay[] = [];
  const latencyByDay: LatencyDataPoint[] = [];

  const currentDate = new Date(startDate);
  const endDateObj = new Date(endDate);

  while (currentDate <= endDateObj) {
    const dateStr = currentDate.toISOString().split('T')[0];
    const total = Math.floor(Math.random() * 20) + 5;
    const completed = Math.floor(total * 0.8);
    const failed = Math.floor(Math.random() * 3);
    const escalated = Math.floor(Math.random() * 2);

    callsByDay.push({
      date: dateStr,
      displayDate: formatDisplayDate(dateStr),
      total,
      completed,
      failed,
      escalated,
    });

    const avgLatency = 200 + Math.random() * 200;
    latencyByDay.push({
      date: dateStr,
      displayDate: formatDisplayDate(dateStr),
      avg: avgLatency,
      p50: avgLatency * 0.9,
      p95: avgLatency * 1.5,
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  const totalCalls = callsByDay.reduce((sum, d) => sum + d.total, 0);

  return {
    success: true,
    metrics: {
      totalCalls: { value: totalCalls, previousValue: totalCalls * 0.8, changePercent: 25, changeIsPositive: true },
      successRate: { value: 85.5, previousValue: 82.0, changePercent: 4.3, changeIsPositive: true },
      avgDuration: { value: 127, previousValue: 145, changePercent: -12.4, changeIsPositive: true },
      avgLatency: { value: 312, previousValue: 350, changePercent: -10.9, changeIsPositive: true },
      bookingRate: { value: 35.2, changePercent: 0, changeIsPositive: true },
      escalationRate: { value: 8.1, changePercent: 0, changeIsPositive: true },
      totalCost: { value: 45.67 },
    },
    callsByDay,
    latencyByDay,
    outcomeDistribution: [
      { outcome: 'appointment_booked', label: 'Cita agendada', count: 35, percent: 35, color: '#22c55e' },
      { outcome: 'information_given', label: 'Información dada', count: 28, percent: 28, color: '#667eea' },
      { outcome: 'escalated_human', label: 'Escalada a humano', count: 12, percent: 12, color: '#f59e0b' },
      { outcome: 'not_interested', label: 'No interesado', count: 15, percent: 15, color: '#94a3b8' },
      { outcome: 'dropped', label: 'Llamada caída', count: 10, percent: 10, color: '#ef4444' },
    ],
    dateRange: { startDate, endDate },
  };
}

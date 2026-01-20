/**
 * TIS TIS Platform - Voice Agent Calls API
 * GET /api/voice-agent/metrics/calls
 *
 * Returns paginated list of calls with filtering and sorting.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// =====================================================
// TYPES
// =====================================================

interface PaginationState {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

interface CallFilters {
  status?: string[];
  outcome?: string[];
  direction?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
}

// =====================================================
// MAIN HANDLER
// =====================================================

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const page = parseInt(searchParams.get('page') || '0', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
    const sortField = searchParams.get('sortField') || 'started_at';
    const sortDirection = searchParams.get('sortDirection') || 'desc';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const status = searchParams.get('status'); // comma-separated
    const outcome = searchParams.get('outcome'); // comma-separated
    const direction = searchParams.get('direction');
    const search = searchParams.get('search');

    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      // Return mock data in development
      return NextResponse.json(getMockCallsData(page, pageSize));
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Build base query
    let query = supabase.from('voice_calls').select('*', { count: 'exact' });

    // Apply filters
    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    if (startDate) {
      query = query.gte('started_at', startDate);
    }

    if (endDate) {
      query = query.lte('started_at', endDate + 'T23:59:59');
    }

    if (status) {
      const statusList = status.split(',');
      query = query.in('status', statusList);
    }

    if (outcome) {
      const outcomeList = outcome.split(',');
      query = query.in('outcome', outcomeList);
    }

    if (direction) {
      query = query.eq('call_direction', direction);
    }

    if (search) {
      query = query.or(`caller_phone.ilike.%${search}%,transcription.ilike.%${search}%`);
    }

    // Apply sorting
    const ascending = sortDirection === 'asc';
    query = query.order(sortField, { ascending });

    // Apply pagination
    const from = page * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    // Execute query
    const { data: calls, count, error } = await query;

    if (error) {
      console.error('Error fetching calls:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch calls' },
        { status: 500 }
      );
    }

    const totalItems = count || 0;
    const totalPages = Math.ceil(totalItems / pageSize);

    const pagination: PaginationState = {
      page,
      pageSize,
      totalItems,
      totalPages,
    };

    const filters: CallFilters = {
      status: status?.split(','),
      outcome: outcome?.split(','),
      direction: direction || undefined,
      search: search || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    };

    return NextResponse.json({
      success: true,
      calls: calls || [],
      pagination,
      filters,
    });
  } catch (error) {
    console.error('Calls API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =====================================================
// MOCK DATA (for development)
// =====================================================

function getMockCallsData(page: number, pageSize: number) {
  const mockCalls = Array.from({ length: 50 }).map((_, i) => {
    const statuses = ['completed', 'completed', 'completed', 'failed', 'escalated'];
    const outcomes = ['appointment_booked', 'information_given', 'escalated_human', 'not_interested', null];
    const directions = ['inbound', 'inbound', 'inbound', 'outbound'];

    const startedAt = new Date();
    startedAt.setHours(startedAt.getHours() - (i * 2));

    return {
      id: `call-${i + 1}`,
      tenant_id: 'tenant-1',
      voice_agent_config_id: 'config-1',
      phone_number_id: 'phone-1',
      call_direction: directions[Math.floor(Math.random() * directions.length)],
      caller_phone: `+52 55 ${Math.floor(1000 + Math.random() * 9000)} ${Math.floor(1000 + Math.random() * 9000)}`,
      called_phone: '+52 55 1234 5678',
      status: statuses[Math.floor(Math.random() * statuses.length)],
      outcome: outcomes[Math.floor(Math.random() * outcomes.length)],
      started_at: startedAt.toISOString(),
      ended_at: new Date(startedAt.getTime() + (60 + Math.random() * 300) * 1000).toISOString(),
      duration_seconds: Math.floor(60 + Math.random() * 300),
      billable_seconds: Math.floor(60 + Math.random() * 300),
      recording_url: Math.random() > 0.3 ? 'https://example.com/recording.mp3' : null,
      recording_duration_seconds: Math.floor(60 + Math.random() * 300),
      transcription: 'Ejemplo de transcripción de la llamada...',
      transcription_segments: [],
      analysis: {
        customer_name: Math.random() > 0.5 ? 'Juan Pérez' : undefined,
        sentiment: ['positive', 'neutral', 'negative'][Math.floor(Math.random() * 3)],
      },
      primary_intent: 'make_appointment',
      detected_intents: ['make_appointment', 'query_hours'],
      detected_signals: [],
      escalated: Math.random() > 0.8,
      cost_usd: 0.05 + Math.random() * 0.2,
      ai_tokens_used: Math.floor(500 + Math.random() * 1500),
      latency_avg_ms: Math.floor(200 + Math.random() * 300),
      turns_count: Math.floor(4 + Math.random() * 10),
      created_at: startedAt.toISOString(),
      updated_at: startedAt.toISOString(),
    };
  });

  const startIndex = page * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedCalls = mockCalls.slice(startIndex, endIndex);

  return {
    success: true,
    calls: paginatedCalls,
    pagination: {
      page,
      pageSize,
      totalItems: mockCalls.length,
      totalPages: Math.ceil(mockCalls.length / pageSize),
    },
    filters: {},
  };
}

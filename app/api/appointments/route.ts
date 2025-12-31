// =====================================================
// TIS TIS PLATFORM - Appointments API Route
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedContext, isAuthError, createAuthErrorResponse } from '@/src/shared/lib/auth-helper';

// ======================
// GET - Fetch appointments
// ======================
export async function GET(request: NextRequest) {
  try {
    const authContext = await getAuthenticatedContext(request);

    if (isAuthError(authContext)) {
      return createAuthErrorResponse(authContext);
    }

    const { client: supabase, tenantId } = authContext;
    const { searchParams } = new URL(request.url);

    // Parse query params with security limits and NaN protection
    const parsedPage = parseInt(searchParams.get('page') || '1', 10);
    const page = isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;
    const parsedPageSize = parseInt(searchParams.get('pageSize') || '20', 10);
    const pageSize = Math.min(isNaN(parsedPageSize) || parsedPageSize < 1 ? 20 : parsedPageSize, 100); // Max 100
    const status = searchParams.get('status');
    const branchId = searchParams.get('branch_id');
    const staffId = searchParams.get('staff_id');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');

    // Allowlist of valid sort columns (prevent SQL injection)
    const ALLOWED_SORT_COLUMNS = ['scheduled_at', 'created_at', 'status', 'duration_minutes', 'updated_at'];
    const requestedSortBy = searchParams.get('sortBy') || 'scheduled_at';
    const sortBy = ALLOWED_SORT_COLUMNS.includes(requestedSortBy) ? requestedSortBy : 'scheduled_at';
    const sortOrder = searchParams.get('sortOrder') || 'asc';

    // Build query
    let query = supabase
      .from('appointments')
      .select(`
        *,
        lead:leads(id, first_name, last_name, full_name, phone, email, classification),
        branch:branches(id, name, city),
        staff:staff(id, first_name, last_name, role),
        service:services(id, name, duration_minutes, price)
      `, { count: 'exact' })
      .eq('tenant_id', tenantId);

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    if (branchId) {
      query = query.eq('branch_id', branchId);
    }
    if (staffId) {
      query = query.eq('staff_id', staffId);
    }
    if (dateFrom) {
      query = query.gte('scheduled_at', dateFrom);
    }
    if (dateTo) {
      query = query.lte('scheduled_at', dateTo);
    }

    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // Apply pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching appointments:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data,
      pagination: {
        page,
        pageSize,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
    });
  } catch (error) {
    console.error('Appointments API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ======================
// POST - Create appointment
// ======================
export async function POST(request: NextRequest) {
  try {
    const authContext = await getAuthenticatedContext(request);

    if (isAuthError(authContext)) {
      return createAuthErrorResponse(authContext);
    }

    const { client: supabase, tenantId } = authContext;
    const body = await request.json();

    // Validate required fields
    if (!body.lead_id) {
      return NextResponse.json(
        { error: 'Lead ID is required' },
        { status: 400 }
      );
    }
    if (!body.branch_id) {
      return NextResponse.json(
        { error: 'Branch ID is required' },
        { status: 400 }
      );
    }
    if (!body.scheduled_at) {
      return NextResponse.json(
        { error: 'Scheduled date is required' },
        { status: 400 }
      );
    }

    // Verify lead exists and belongs to user's tenant
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, full_name')
      .eq('tenant_id', tenantId)
      .eq('id', body.lead_id)
      .single();

    if (leadError || !lead) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      );
    }

    // Get service duration if service_id provided
    let durationMinutes = body.duration_minutes || 60;
    if (body.service_id) {
      const { data: service } = await supabase
        .from('services')
        .select('duration_minutes')
        .eq('id', body.service_id)
        .single();

      if (service) {
        durationMinutes = service.duration_minutes;
      }
    }

    // Create appointment with authenticated user's tenant
    const appointmentData = {
      tenant_id: tenantId,
      lead_id: body.lead_id,
      branch_id: body.branch_id,
      staff_id: body.staff_id || null,
      service_id: body.service_id || null,
      scheduled_at: body.scheduled_at,
      duration_minutes: durationMinutes,
      status: 'scheduled',
      source: body.source || 'manual',
      notes: body.notes || null,
      reminder_sent: false,
      confirmation_sent: false,
    };

    const { data, error } = await supabase
      .from('appointments')
      .insert(appointmentData)
      .select(`
        *,
        lead:leads(id, full_name, phone),
        branch:branches(id, name),
        staff:staff(id, first_name, last_name),
        service:services(id, name)
      `)
      .single();

    if (error) {
      console.error('Error creating appointment:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Update lead status to contacted
    await supabase
      .from('leads')
      .update({ status: 'contacted' })
      .eq('id', body.lead_id)
      .eq('status', 'new');

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('Appointments API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

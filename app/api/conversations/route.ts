// =====================================================
// TIS TIS PLATFORM - Conversations API Route
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedContext, isAuthError, createAuthErrorResponse } from '@/src/shared/lib/auth-helper';

// ======================
// GET - Fetch conversations
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
    const channel = searchParams.get('channel');
    const aiHandling = searchParams.get('ai_handling');
    const branchId = searchParams.get('branch_id');

    // Allowlist of valid sort columns (prevent SQL injection)
    const ALLOWED_SORT_COLUMNS = ['last_message_at', 'created_at', 'status', 'channel', 'updated_at'];
    const requestedSortBy = searchParams.get('sortBy') || 'last_message_at';
    const sortBy = ALLOWED_SORT_COLUMNS.includes(requestedSortBy) ? requestedSortBy : 'last_message_at';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Build query - use authenticated user's tenant
    let query = supabase
      .from('conversations')
      .select(`
        *,
        lead:leads(id, first_name, last_name, full_name, phone, email, classification, score),
        branch:branches(id, name),
        assigned_staff:staff(id, first_name, last_name, role)
      `, { count: 'exact' })
      .eq('tenant_id', tenantId);

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    if (channel) {
      query = query.eq('channel', channel);
    }
    if (aiHandling !== null && aiHandling !== undefined) {
      query = query.eq('ai_handling', aiHandling === 'true');
    }
    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc', nullsFirst: false });

    // Apply pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching conversations:', error);
      return NextResponse.json(
        { error: 'Failed to fetch conversations' },
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
    console.error('Conversations API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ======================
// POST - Create conversation
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

    // Verify lead exists and belongs to this tenant
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, full_name, branch_id')
      .eq('tenant_id', tenantId)
      .eq('id', body.lead_id)
      .single();

    if (leadError || !lead) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      );
    }

    // Check for existing active conversation
    const { data: existingConversation } = await supabase
      .from('conversations')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('lead_id', body.lead_id)
      .in('status', ['active', 'pending'])
      .single();

    if (existingConversation) {
      return NextResponse.json(
        {
          error: 'Active conversation already exists',
          conversationId: existingConversation.id
        },
        { status: 409 }
      );
    }

    // Create conversation with authenticated user's tenant
    const conversationData = {
      tenant_id: tenantId,
      lead_id: body.lead_id,
      branch_id: body.branch_id || lead.branch_id,
      channel: body.channel || 'whatsapp',
      status: 'active',
      ai_handling: body.ai_handling !== false, // Default to true
      assigned_staff_id: body.assigned_staff_id || null,
      started_at: new Date().toISOString(),
      last_message_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('conversations')
      .insert(conversationData)
      .select(`
        *,
        lead:leads(id, full_name, phone),
        branch:branches(id, name)
      `)
      .single();

    if (error) {
      console.error('Error creating conversation:', error);
      return NextResponse.json(
        { error: 'Failed to create conversation' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('Conversations API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

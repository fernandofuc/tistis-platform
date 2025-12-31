// =====================================================
// TIS TIS PLATFORM - Leads API Route
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Get authenticated context with tenant validation
async function getAuthenticatedContext(request: NextRequest) {
  const authHeader = request.headers.get('authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return { error: 'Authentication required', status: 401 };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: 'Invalid or expired token', status: 401 };
  }

  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
  const { data: userRole, error: roleError } = await serviceClient
    .from('user_roles')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .single();

  if (roleError || !userRole) {
    return { error: 'User has no assigned role', status: 403 };
  }

  return {
    client: serviceClient,
    user,
    tenantId: userRole.tenant_id,
    role: userRole.role,
  };
}

// ======================
// GET - Fetch leads
// ======================
export async function GET(request: NextRequest) {
  try {
    const authContext = await getAuthenticatedContext(request);

    if ('error' in authContext) {
      return NextResponse.json(
        { error: authContext.error },
        { status: authContext.status }
      );
    }

    const { client: supabase, tenantId } = authContext;
    const { searchParams } = new URL(request.url);

    // Parse query params with security limits and NaN protection
    const parsedPage = parseInt(searchParams.get('page') || '1', 10);
    const page = isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;
    const parsedPageSize = parseInt(searchParams.get('pageSize') || '20', 10);
    const pageSize = Math.min(isNaN(parsedPageSize) || parsedPageSize < 1 ? 20 : parsedPageSize, 100); // Max 100
    const classification = searchParams.get('classification');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    // Allowlist of valid sort columns (prevent SQL injection)
    const ALLOWED_SORT_COLUMNS = ['score', 'created_at', 'status', 'classification', 'first_name', 'last_name', 'full_name', 'updated_at'];
    const requestedSortBy = searchParams.get('sortBy') || 'score';
    const sortBy = ALLOWED_SORT_COLUMNS.includes(requestedSortBy) ? requestedSortBy : 'score';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Build query - use authenticated user's tenant
    let query = supabase
      .from('leads')
      .select('*, branches(name, city)', { count: 'exact' })
      .eq('tenant_id', tenantId);

    // Apply filters
    if (classification) {
      query = query.eq('classification', classification);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (search) {
      // Sanitize search input to prevent PostgREST filter injection
      // Escape special characters used in PostgREST patterns
      const sanitizedSearch = search.replace(/[%_*\\]/g, '\\$&');
      // Use * wildcard for more reliable PostgREST pattern matching
      // Search in full_name, first_name, last_name (not "name" which doesn't exist)
      const pattern = `*${sanitizedSearch}*`;
      query = query.or(`full_name.ilike.${pattern},first_name.ilike.${pattern},last_name.ilike.${pattern},phone.ilike.${pattern},email.ilike.${pattern}`);
    }

    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // Apply pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching leads:', error);
      return NextResponse.json(
        { error: 'Failed to fetch leads' },
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
    console.error('Leads API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ======================
// POST - Create lead
// ======================
export async function POST(request: NextRequest) {
  try {
    const authContext = await getAuthenticatedContext(request);

    if ('error' in authContext) {
      return NextResponse.json(
        { error: authContext.error },
        { status: authContext.status }
      );
    }

    const { client: supabase, tenantId } = authContext;
    const body = await request.json();

    // Validate required fields
    if (!body.phone) {
      return NextResponse.json(
        { error: 'Phone is required' },
        { status: 400 }
      );
    }

    // Normalize phone
    let normalizedPhone = body.phone.replace(/[^\d+]/g, '');
    if (normalizedPhone.length === 10) {
      normalizedPhone = `+52${normalizedPhone}`;
    } else if (normalizedPhone.length === 12 && normalizedPhone.startsWith('52')) {
      normalizedPhone = `+${normalizedPhone}`;
    }

    // Check if lead exists in this tenant
    const { data: existingLead } = await supabase
      .from('leads')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('phone_normalized', normalizedPhone)
      .single();

    if (existingLead) {
      return NextResponse.json(
        { error: 'Lead already exists', leadId: existingLead.id },
        { status: 409 }
      );
    }

    // Parse name into first_name and last_name
    const fullName = body.name || body.full_name || '';
    const nameParts = fullName.trim().split(' ');
    const firstName = nameParts[0] || null;
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null;

    // Create lead with authenticated user's tenant
    const leadData = {
      tenant_id: tenantId,
      phone: body.phone,
      phone_normalized: normalizedPhone,
      first_name: body.first_name || firstName,
      last_name: body.last_name || lastName,
      full_name: fullName || null,
      email: body.email || null,
      source: body.source || 'website',
      status: 'new',
      classification: 'warm',
      score: 50,
      interested_services: body.interested_services || [],
      branch_id: body.branch_id || null,
      notes: body.notes || null,
      tags: body.tags || [],
    };

    const { data, error } = await supabase
      .from('leads')
      .insert(leadData)
      .select()
      .single();

    if (error) {
      console.error('Error creating lead:', error);
      return NextResponse.json(
        { error: 'Failed to create lead' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('Leads API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

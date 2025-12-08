export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// =====================================================
// Helper: Get authenticated user and validate tenant
// =====================================================
async function getAuthenticatedContext(request: NextRequest) {
  const authHeader = request.headers.get('authorization');

  if (!authHeader) {
    return {
      client: createClient(supabaseUrl, supabaseServiceKey),
      user: null,
      tenantId: null,
      role: null,
      isServiceCall: true,
    };
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
    isServiceCall: false,
  };
}

// =====================================================
// GET /api/quotes - List quotes with filters
// =====================================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedTenantId = searchParams.get('tenant_id');
    const status = searchParams.get('status');
    const patientId = searchParams.get('patient_id');
    const leadId = searchParams.get('lead_id');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = (page - 1) * limit;

    const authContext = await getAuthenticatedContext(request);

    if ('error' in authContext) {
      return NextResponse.json(
        { error: authContext.error },
        { status: authContext.status }
      );
    }

    const { client: supabase, tenantId: userTenantId, isServiceCall } = authContext;

    let effectiveTenantId: string;

    if (isServiceCall) {
      effectiveTenantId = requestedTenantId || 'a0000000-0000-0000-0000-000000000001';
    } else {
      if (requestedTenantId && requestedTenantId !== userTenantId) {
        return NextResponse.json(
          { error: 'Access denied to requested tenant' },
          { status: 403 }
        );
      }
      effectiveTenantId = userTenantId!;
    }

    let query = supabase
      .from('quotes')
      .select(`
        *,
        patient:patients!patient_id(id, patient_number, first_name, last_name, phone, email),
        lead:leads!lead_id(id, name, phone, email, classification),
        created_by_user:staff_members!created_by(id, first_name, last_name),
        quote_items(id, service_name, quantity, unit_price, discount_percentage, discount_amount, subtotal)
      `, { count: 'exact' })
      .eq('tenant_id', effectiveTenantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filters
    if (status) {
      query = query.eq('status', status);
    }

    if (patientId) {
      query = query.eq('patient_id', patientId);
    }

    if (leadId) {
      query = query.eq('lead_id', leadId);
    }

    // Search by quote number
    if (search) {
      const sanitizedSearch = search.replace(/[%_]/g, '\\$&');
      query = query.ilike('quote_number', `%${sanitizedSearch}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching quotes:', error);
      return NextResponse.json(
        { error: 'Failed to fetch quotes', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      quotes: data,
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Error in GET /api/quotes:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =====================================================
// POST /api/quotes - Create new quote
// =====================================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const authContext = await getAuthenticatedContext(request);

    if ('error' in authContext) {
      return NextResponse.json(
        { error: authContext.error },
        { status: authContext.status }
      );
    }

    const { client: supabase, tenantId: userTenantId, user, isServiceCall } = authContext;

    let effectiveTenantId: string;

    if (isServiceCall) {
      effectiveTenantId = body.tenant_id || 'a0000000-0000-0000-0000-000000000001';
    } else {
      if (body.tenant_id && body.tenant_id !== userTenantId) {
        return NextResponse.json(
          { error: 'Cannot create quote for different tenant' },
          { status: 403 }
        );
      }
      effectiveTenantId = userTenantId!;
    }

    // Validate: must have patient_id OR lead_id (not both, unless draft)
    const hasPatient = !!body.patient_id;
    const hasLead = !!body.lead_id;
    const isDraft = body.status === 'draft' || !body.status;

    if (hasPatient && hasLead) {
      return NextResponse.json(
        { error: 'Quote cannot have both patient_id and lead_id' },
        { status: 400 }
      );
    }

    if (!hasPatient && !hasLead && !isDraft) {
      return NextResponse.json(
        { error: 'Non-draft quote must have either patient_id or lead_id' },
        { status: 400 }
      );
    }

    // Validate valid_until if provided
    if (body.valid_until) {
      const validUntil = new Date(body.valid_until);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (validUntil < today) {
        return NextResponse.json(
          { error: 'valid_until cannot be in the past' },
          { status: 400 }
        );
      }
    }

    const newQuote = {
      tenant_id: effectiveTenantId,
      patient_id: body.patient_id || null,
      lead_id: body.lead_id || null,
      status: body.status || 'draft',
      valid_until: body.valid_until || null,
      currency: body.currency || 'MXN',
      discount_percentage: body.discount_percentage || 0,
      discount_amount: body.discount_amount || 0,
      tax_percentage: body.tax_percentage || 16, // IVA Mexico
      notes: body.notes?.trim() || null,
      terms_and_conditions: body.terms_and_conditions?.trim() || null,
      created_by: user?.id || body.created_by || null,
    };

    const { data, error } = await supabase
      .from('quotes')
      .insert(newQuote)
      .select(`
        *,
        patient:patients!patient_id(id, patient_number, first_name, last_name, phone, email),
        lead:leads!lead_id(id, name, phone, email, classification)
      `)
      .single();

    if (error) {
      console.error('Error creating quote:', error);
      return NextResponse.json(
        { error: 'Failed to create quote', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ quote: data }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/quotes:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

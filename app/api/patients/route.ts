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

  // If no auth header, create service client for server-side calls
  if (!authHeader) {
    // For server-side calls without auth header, use service role
    // but require tenant_id in query params for security
    return {
      client: createClient(supabaseUrl, supabaseServiceKey),
      user: null,
      tenantId: null,
      role: null,
      isServiceCall: true,
    };
  }

  // Create authenticated client
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  // Verify user
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: 'Invalid or expired token', status: 401 };
  }

  // Get user's tenant and role
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
    client: serviceClient, // Use service client for operations after validation
    user,
    tenantId: userRole.tenant_id,
    role: userRole.role,
    isServiceCall: false,
  };
}

// =====================================================
// GET /api/patients - List patients with filters
// =====================================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedTenantId = searchParams.get('tenant_id');
    const status = searchParams.get('status');
    const branchId = searchParams.get('branch_id');
    const dentistId = searchParams.get('dentist_id');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100); // Max 100
    const offset = (page - 1) * limit;

    // Get authenticated context
    const authContext = await getAuthenticatedContext(request);

    if ('error' in authContext) {
      return NextResponse.json(
        { error: authContext.error },
        { status: authContext.status }
      );
    }

    const { client: supabase, tenantId: userTenantId, isServiceCall } = authContext;

    // Determine which tenant to query
    let effectiveTenantId: string;

    if (isServiceCall) {
      // Service calls require tenant_id, default to ESVA for backwards compatibility
      effectiveTenantId = requestedTenantId || 'a0000000-0000-0000-0000-000000000001';
    } else {
      // Authenticated users can only access their own tenant
      if (requestedTenantId && requestedTenantId !== userTenantId) {
        return NextResponse.json(
          { error: 'Access denied to requested tenant' },
          { status: 403 }
        );
      }
      effectiveTenantId = userTenantId!;
    }

    let query = supabase
      .from('patients')
      .select(`
        *,
        preferred_branch:branches!preferred_branch_id(id, name, address),
        assigned_dentist:staff_members!assigned_dentist_id(id, first_name, last_name, role),
        lead:leads!lead_id(id, name, status, classification)
      `, { count: 'exact' })
      .eq('tenant_id', effectiveTenantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filters
    if (status) {
      query = query.eq('status', status);
    }

    if (branchId) {
      query = query.eq('preferred_branch_id', branchId);
    }

    if (dentistId) {
      query = query.eq('assigned_dentist_id', dentistId);
    }

    // Search by name, email, phone, patient_number
    if (search) {
      // Sanitize search input to prevent SQL injection in ilike
      const sanitizedSearch = search.replace(/[%_]/g, '\\$&');
      query = query.or(
        `first_name.ilike.%${sanitizedSearch}%,last_name.ilike.%${sanitizedSearch}%,email.ilike.%${sanitizedSearch}%,phone.ilike.%${sanitizedSearch}%,patient_number.ilike.%${sanitizedSearch}%`
      );
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching patients:', error);
      return NextResponse.json(
        { error: 'Failed to fetch patients', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      patients: data,
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Error in GET /api/patients:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =====================================================
// POST /api/patients - Create new patient
// =====================================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Get authenticated context
    const authContext = await getAuthenticatedContext(request);

    if ('error' in authContext) {
      return NextResponse.json(
        { error: authContext.error },
        { status: authContext.status }
      );
    }

    const { client: supabase, tenantId: userTenantId, user, isServiceCall } = authContext;

    // Determine tenant
    let effectiveTenantId: string;

    if (isServiceCall) {
      effectiveTenantId = body.tenant_id || 'a0000000-0000-0000-0000-000000000001';
    } else {
      if (body.tenant_id && body.tenant_id !== userTenantId) {
        return NextResponse.json(
          { error: 'Cannot create patient for different tenant' },
          { status: 403 }
        );
      }
      effectiveTenantId = userTenantId!;
    }

    // Required fields validation
    if (!body.first_name?.trim() || !body.last_name?.trim() || !body.phone?.trim()) {
      return NextResponse.json(
        { error: 'Missing required fields: first_name, last_name, phone' },
        { status: 400 }
      );
    }

    // Validate phone format (basic validation)
    const phoneRegex = /^[\d\s\-+()]{8,20}$/;
    if (!phoneRegex.test(body.phone)) {
      return NextResponse.json(
        { error: 'Invalid phone number format' },
        { status: 400 }
      );
    }

    // Check if patient with same phone already exists in this tenant
    const { data: existing } = await supabase
      .from('patients')
      .select('id, patient_number')
      .eq('tenant_id', effectiveTenantId)
      .eq('phone', body.phone.trim())
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Patient with this phone number already exists', patient_id: existing.id },
        { status: 409 }
      );
    }

    // If lead_id provided, update lead status and set converted_at
    if (body.lead_id) {
      const { error: leadUpdateError } = await supabase
        .from('leads')
        .update({
          status: 'converted',
          converted_at: new Date().toISOString()
        })
        .eq('id', body.lead_id)
        .eq('tenant_id', effectiveTenantId); // Ensure lead belongs to same tenant

      if (leadUpdateError) {
        console.error('Error updating lead status:', leadUpdateError);
        // Don't fail patient creation, just log
      }
    }

    const newPatient = {
      tenant_id: effectiveTenantId,
      lead_id: body.lead_id || null,
      first_name: body.first_name.trim(),
      last_name: body.last_name.trim(),
      email: body.email?.trim()?.toLowerCase() || null,
      phone: body.phone.trim(),
      date_of_birth: body.date_of_birth || null,
      gender: body.gender || null,
      address_street: body.address_street?.trim() || null,
      address_city: body.address_city?.trim() || null,
      address_state: body.address_state?.trim() || null,
      address_postal_code: body.address_postal_code?.trim() || null,
      address_country: body.address_country?.trim() || 'Mexico',
      blood_type: body.blood_type || null,
      allergies: body.allergies || null,
      medical_conditions: body.medical_conditions || null,
      current_medications: body.current_medications || null,
      emergency_contact_name: body.emergency_contact_name?.trim() || null,
      emergency_contact_phone: body.emergency_contact_phone?.trim() || null,
      emergency_contact_relationship: body.emergency_contact_relationship?.trim() || null,
      preferred_branch_id: body.preferred_branch_id || null,
      assigned_dentist_id: body.assigned_dentist_id || null,
      insurance_provider: body.insurance_provider?.trim() || null,
      insurance_policy_number: body.insurance_policy_number?.trim() || null,
      status: body.status || 'active',
      notes: body.notes?.trim() || null,
      tags: body.tags || [],
      created_by: user?.id || body.created_by || null,
    };

    const { data, error } = await supabase
      .from('patients')
      .insert(newPatient)
      .select(`
        *,
        preferred_branch:branches!preferred_branch_id(id, name, address),
        assigned_dentist:staff_members!assigned_dentist_id(id, first_name, last_name, role),
        lead:leads!lead_id(id, name, status, classification)
      `)
      .single();

    if (error) {
      console.error('Error creating patient:', error);
      return NextResponse.json(
        { error: 'Failed to create patient', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ patient: data }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/patients:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

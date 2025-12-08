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
// Helper: Verify patient belongs to user's tenant
// =====================================================
async function verifyPatientAccess(
  supabase: ReturnType<typeof createClient>,
  patientId: string,
  userTenantId: string | null,
  isServiceCall: boolean
) {
  const { data: patient, error } = await supabase
    .from('patients')
    .select('id, tenant_id')
    .eq('id', patientId)
    .single();

  if (error || !patient) {
    return { error: 'Patient not found', status: 404 };
  }

  if (!isServiceCall && patient.tenant_id !== userTenantId) {
    return { error: 'Access denied to this patient', status: 403 };
  }

  return { tenantId: patient.tenant_id };
}

// =====================================================
// GET /api/patients/[id] - Get single patient with full details
// =====================================================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: 'Invalid patient ID format' },
        { status: 400 }
      );
    }

    const authContext = await getAuthenticatedContext(request);

    if ('error' in authContext) {
      return NextResponse.json(
        { error: authContext.error },
        { status: authContext.status }
      );
    }

    const { client: supabase, tenantId: userTenantId, isServiceCall } = authContext;

    // Verify access to this patient
    const accessCheck = await verifyPatientAccess(supabase, id, userTenantId, isServiceCall);
    if ('error' in accessCheck) {
      return NextResponse.json(
        { error: accessCheck.error },
        { status: accessCheck.status }
      );
    }

    const { data, error } = await supabase
      .from('patients')
      .select(`
        *,
        preferred_branch:branches!preferred_branch_id(id, name, address, phone, city, state),
        assigned_dentist:staff_members!assigned_dentist_id(id, first_name, last_name, role, phone, email),
        lead:leads!lead_id(id, name, status, classification, score, source, services_interested, notes),
        clinical_history(
          id,
          visit_date,
          chief_complaint,
          diagnosis,
          treatment_provided,
          dentist:staff_members!dentist_id(first_name, last_name),
          branch:branches!branch_id(name)
        ),
        patient_files(
          id,
          file_name,
          file_type,
          file_category,
          description,
          created_at
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Patient not found' },
          { status: 404 }
        );
      }
      console.error('Error fetching patient:', error);
      return NextResponse.json(
        { error: 'Failed to fetch patient', details: error.message },
        { status: 500 }
      );
    }

    // Get appointment statistics
    if (data.lead_id) {
      const { count: appointmentsCount } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('lead_id', data.lead_id);

      data.total_appointments = appointmentsCount || 0;
    }

    return NextResponse.json({ patient: data });
  } catch (error) {
    console.error('Error in GET /api/patients/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =====================================================
// PATCH /api/patients/[id] - Update patient
// =====================================================
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: 'Invalid patient ID format' },
        { status: 400 }
      );
    }

    const authContext = await getAuthenticatedContext(request);

    if ('error' in authContext) {
      return NextResponse.json(
        { error: authContext.error },
        { status: authContext.status }
      );
    }

    const { client: supabase, tenantId: userTenantId, user, isServiceCall } = authContext;

    // Verify access
    const accessCheck = await verifyPatientAccess(supabase, id, userTenantId, isServiceCall);
    if ('error' in accessCheck) {
      return NextResponse.json(
        { error: accessCheck.error },
        { status: accessCheck.status }
      );
    }

    // Allowed fields to update
    const allowedFields = [
      'first_name',
      'last_name',
      'email',
      'phone',
      'date_of_birth',
      'gender',
      'address_street',
      'address_city',
      'address_state',
      'address_postal_code',
      'address_country',
      'blood_type',
      'allergies',
      'medical_conditions',
      'current_medications',
      'emergency_contact_name',
      'emergency_contact_phone',
      'emergency_contact_relationship',
      'preferred_branch_id',
      'assigned_dentist_id',
      'insurance_provider',
      'insurance_policy_number',
      'status',
      'notes',
      'tags',
    ];

    const updateData: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        // Trim string values
        if (typeof body[field] === 'string') {
          updateData[field] = body[field].trim();
        } else {
          updateData[field] = body[field];
        }
      }
    }

    // Normalize email to lowercase
    if (updateData.email && typeof updateData.email === 'string') {
      updateData.email = updateData.email.toLowerCase();
    }

    // Validate phone if provided
    if (updateData.phone) {
      const phoneRegex = /^[\d\s\-+()]{8,20}$/;
      if (!phoneRegex.test(updateData.phone as string)) {
        return NextResponse.json(
          { error: 'Invalid phone number format' },
          { status: 400 }
        );
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Track who made the update
    updateData.updated_by = user?.id || body.updated_by || null;

    const { data, error } = await supabase
      .from('patients')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        preferred_branch:branches!preferred_branch_id(id, name, address),
        assigned_dentist:staff_members!assigned_dentist_id(id, first_name, last_name, role),
        lead:leads!lead_id(id, name, status, classification)
      `)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Patient not found' },
          { status: 404 }
        );
      }
      console.error('Error updating patient:', error);
      return NextResponse.json(
        { error: 'Failed to update patient', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ patient: data });
  } catch (error) {
    console.error('Error in PATCH /api/patients/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =====================================================
// DELETE /api/patients/[id] - Soft delete (archive) patient
// =====================================================
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: 'Invalid patient ID format' },
        { status: 400 }
      );
    }

    const authContext = await getAuthenticatedContext(request);

    if ('error' in authContext) {
      return NextResponse.json(
        { error: authContext.error },
        { status: authContext.status }
      );
    }

    const { client: supabase, tenantId: userTenantId, role, isServiceCall } = authContext;

    // Only admin/receptionist can archive patients
    if (!isServiceCall && role && !['admin', 'receptionist', 'super_admin'].includes(role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to archive patients' },
        { status: 403 }
      );
    }

    // Verify access
    const accessCheck = await verifyPatientAccess(supabase, id, userTenantId, isServiceCall);
    if ('error' in accessCheck) {
      return NextResponse.json(
        { error: accessCheck.error },
        { status: accessCheck.status }
      );
    }

    // Soft delete: set status to 'archived'
    const { data, error } = await supabase
      .from('patients')
      .update({ status: 'archived' })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Patient not found' },
          { status: 404 }
        );
      }
      console.error('Error archiving patient:', error);
      return NextResponse.json(
        { error: 'Failed to archive patient', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Patient archived successfully',
      patient: data,
    });
  } catch (error) {
    console.error('Error in DELETE /api/patients/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Get authenticated context with tenant validation
async function getAuthenticatedContext(request: NextRequest) {
  const authHeader = request.headers.get('authorization');

  // If no auth header, require INTERNAL_API_KEY for service calls
  if (!authHeader) {
    const internalApiKey = request.headers.get('x-internal-api-key');
    const expectedKey = process.env.INTERNAL_API_KEY;

    if (!expectedKey) {
      if (process.env.NODE_ENV === 'production') {
        return { error: 'Service authentication not configured', status: 503 };
      }
      return {
        client: createClient(supabaseUrl, supabaseServiceKey),
        user: null,
        tenantId: null,
        role: null,
        isServiceCall: true,
      };
    }

    if (!internalApiKey) {
      return { error: 'Authentication required', status: 401 };
    }

    try {
      const keyBuffer = Buffer.from(internalApiKey);
      const expectedBuffer = Buffer.from(expectedKey);
      if (keyBuffer.length !== expectedBuffer.length || !timingSafeEqual(keyBuffer, expectedBuffer)) {
        return { error: 'Invalid API key', status: 401 };
      }
    } catch {
      return { error: 'Invalid API key', status: 401 };
    }

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
// GET /api/patients/[id]/clinical-history - Get patient clinical history
// =====================================================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: patientId } = await params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(patientId)) {
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

    // Verify patient belongs to user's tenant
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('id, tenant_id')
      .eq('id', patientId)
      .single();

    if (patientError || !patient) {
      return NextResponse.json(
        { error: 'Patient not found' },
        { status: 404 }
      );
    }

    if (!isServiceCall && patient.tenant_id !== userTenantId) {
      return NextResponse.json(
        { error: 'Access denied to this patient' },
        { status: 403 }
      );
    }

    const { data, error } = await supabase
      .from('clinical_history')
      .select(`
        *,
        dentist:staff!dentist_id(id, first_name, last_name, role),
        branch:branches!branch_id(id, name, address),
        appointment:appointments!appointment_id(id, scheduled_at, status),
        patient:patients!patient_id(id, first_name, last_name, patient_number)
      `)
      .eq('patient_id', patientId)
      .order('visit_date', { ascending: false });

    if (error) {
      console.error('Error fetching clinical history:', error);
      return NextResponse.json(
        { error: 'Failed to fetch clinical history' },
        { status: 500 }
      );
    }

    return NextResponse.json({ clinical_history: data });
  } catch (error) {
    console.error('Error in GET /api/patients/[id]/clinical-history:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =====================================================
// POST /api/patients/[id]/clinical-history - Create clinical history record
// =====================================================
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: patientId } = await params;
    const body = await request.json();

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(patientId)) {
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

    // Verify patient exists and belongs to tenant
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('id, tenant_id')
      .eq('id', patientId)
      .single();

    if (patientError || !patient) {
      return NextResponse.json(
        { error: 'Patient not found' },
        { status: 404 }
      );
    }

    if (!isServiceCall && patient.tenant_id !== userTenantId) {
      return NextResponse.json(
        { error: 'Access denied to this patient' },
        { status: 403 }
      );
    }

    // Required fields
    if (!body.visit_date || !body.dentist_id) {
      return NextResponse.json(
        { error: 'Missing required fields: visit_date, dentist_id' },
        { status: 400 }
      );
    }

    const newRecord = {
      tenant_id: patient.tenant_id,
      patient_id: patientId,
      appointment_id: body.appointment_id || null,
      visit_date: body.visit_date,
      dentist_id: body.dentist_id,
      branch_id: body.branch_id || null,
      chief_complaint: body.chief_complaint || null,
      diagnosis: body.diagnosis || null,
      treatment_provided: body.treatment_provided || null,
      treatment_plan: body.treatment_plan || null,
      prescriptions: body.prescriptions || null,
      dental_chart: body.dental_chart || null,
      blood_pressure: body.blood_pressure || null,
      heart_rate: body.heart_rate || null,
      temperature: body.temperature || null,
      files: body.files || [],
      notes: body.notes || null,
      next_appointment_recommended: body.next_appointment_recommended || null,
      created_by: body.created_by || null,
    };

    const { data, error } = await supabase
      .from('clinical_history')
      .insert(newRecord)
      .select(`
        *,
        dentist:staff!dentist_id(id, first_name, last_name, role),
        branch:branches!branch_id(id, name, address),
        appointment:appointments!appointment_id(id, scheduled_at, status)
      `)
      .single();

    if (error) {
      console.error('Error creating clinical history record:', error);
      return NextResponse.json(
        { error: 'Failed to create clinical history record' },
        { status: 500 }
      );
    }

    return NextResponse.json({ clinical_history: data }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/patients/[id]/clinical-history:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

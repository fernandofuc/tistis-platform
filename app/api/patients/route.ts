import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// =====================================================
// GET /api/patients - List patients with filters
// =====================================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenant_id') || 'a0000000-0000-0000-0000-000000000001'; // ESVA
    const status = searchParams.get('status'); // 'active', 'inactive', 'archived'
    const branchId = searchParams.get('branch_id');
    const dentistId = searchParams.get('dentist_id');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    let query = supabase
      .from('patients')
      .select(`
        *,
        preferred_branch:branches!preferred_branch_id(id, name, address),
        assigned_dentist:staff_members!assigned_dentist_id(id, first_name, last_name, role),
        lead:leads!lead_id(id, name, status, classification)
      `, { count: 'exact' })
      .eq('tenant_id', tenantId)
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
      query = query.or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%,patient_number.ilike.%${search}%`
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
    const tenantId = body.tenant_id || 'a0000000-0000-0000-0000-000000000001'; // ESVA

    // Required fields
    if (!body.first_name || !body.last_name || !body.phone) {
      return NextResponse.json(
        { error: 'Missing required fields: first_name, last_name, phone' },
        { status: 400 }
      );
    }

    // Check if patient with same phone already exists
    const { data: existing } = await supabase
      .from('patients')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('phone', body.phone)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Patient with this phone number already exists', patient_id: existing.id },
        { status: 409 }
      );
    }

    // If lead_id provided, update lead status
    if (body.lead_id) {
      await supabase
        .from('leads')
        .update({ status: 'converted' })
        .eq('id', body.lead_id);
    }

    const newPatient = {
      tenant_id: tenantId,
      lead_id: body.lead_id || null,
      first_name: body.first_name,
      last_name: body.last_name,
      email: body.email || null,
      phone: body.phone,
      date_of_birth: body.date_of_birth || null,
      gender: body.gender || null,
      address_street: body.address_street || null,
      address_city: body.address_city || null,
      address_state: body.address_state || null,
      address_postal_code: body.address_postal_code || null,
      address_country: body.address_country || 'México',
      blood_type: body.blood_type || null,
      allergies: body.allergies || null,
      medical_conditions: body.medical_conditions || null,
      current_medications: body.current_medications || null,
      emergency_contact_name: body.emergency_contact_name || null,
      emergency_contact_phone: body.emergency_contact_phone || null,
      emergency_contact_relationship: body.emergency_contact_relationship || null,
      preferred_branch_id: body.preferred_branch_id || null,
      assigned_dentist_id: body.assigned_dentist_id || null,
      insurance_provider: body.insurance_provider || null,
      insurance_policy_number: body.insurance_policy_number || null,
      status: body.status || 'active',
      notes: body.notes || null,
      tags: body.tags || [],
      created_by: body.created_by || null,
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

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// =====================================================
// GET /api/patients/[id] - Get single patient with full details
// =====================================================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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
      'updated_by',
    ];

    const updateData: any = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

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

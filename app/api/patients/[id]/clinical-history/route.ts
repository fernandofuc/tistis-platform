export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create client lazily to avoid build-time errors
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseKey);
}

// =====================================================
// GET /api/patients/[id]/clinical-history - Get patient clinical history
// =====================================================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabaseClient();
    const { id: patientId } = await params;

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
        { error: 'Failed to fetch clinical history', details: error.message },
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
    const supabase = getSupabaseClient();
    const { id: patientId } = await params;
    const body = await request.json();

    // Verify patient exists
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
        { error: 'Failed to create clinical history record', details: error.message },
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

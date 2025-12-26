// =====================================================
// TIS TIS PLATFORM - Single Appointment API Route
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, DEFAULT_TENANT_ID } from '@/src/shared/lib/supabase';
import { LeadConversionService } from '@/src/features/ai/services/lead-conversion.service';

// ======================
// GET - Fetch single appointment
// ======================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('appointments')
      .select(`
        *,
        lead:leads(id, first_name, last_name, full_name, phone, email, classification, score),
        branch:branches(id, name, city, address, phone),
        staff:staff(id, first_name, last_name, role, email),
        service:services(id, name, duration_minutes, price, description)
      `)
      .eq('tenant_id', DEFAULT_TENANT_ID)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Appointment not found' },
          { status: 404 }
        );
      }
      console.error('Error fetching appointment:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Appointment API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ======================
// PATCH - Update appointment
// ======================
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServerClient();
    const body = await request.json();

    // Fields allowed for update
    const allowedFields = [
      'branch_id', 'staff_id', 'service_id', 'scheduled_at',
      'duration_minutes', 'status', 'notes', 'reminder_sent',
      'confirmation_sent', 'cancelled_reason', 'outcome'
    ];

    // Filter only allowed fields
    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // Handle status transitions
    if (updateData.status === 'cancelled' && body.cancelled_reason) {
      updateData.cancelled_at = new Date().toISOString();
    }
    if (updateData.status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('appointments')
      .update(updateData)
      .eq('tenant_id', DEFAULT_TENANT_ID)
      .eq('id', id)
      .select(`
        *,
        lead:leads(id, full_name, phone),
        branch:branches(id, name),
        staff:staff(id, first_name, last_name),
        service:services(id, name)
      `)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Appointment not found' },
          { status: 404 }
        );
      }
      console.error('Error updating appointment:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Update lead status and auto-convert to patient when appointment completes
    if (updateData.status === 'completed' && data.lead_id) {
      try {
        // Auto-convert lead to patient
        const conversionResult = await LeadConversionService.autoConvertQualifiedLead(data.lead_id);

        if (conversionResult?.success) {
          console.log(`[Appointment] Lead ${data.lead_id} auto-converted to patient ${conversionResult.patient_id}`);
        } else {
          // Fallback: at least update lead status
          await supabase
            .from('leads')
            .update({ status: 'converted' })
            .eq('id', data.lead_id);
        }
      } catch (conversionError) {
        console.error('[Appointment] Auto-conversion error:', conversionError);
        // Fallback: update lead status even if conversion fails
        await supabase
          .from('leads')
          .update({ status: 'converted' })
          .eq('id', data.lead_id);
      }
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Appointment API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ======================
// DELETE - Cancel appointment (soft delete)
// ======================
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServerClient();
    const { searchParams } = new URL(request.url);
    const reason = searchParams.get('reason') || 'Cancelled by user';

    // Soft delete - update status to cancelled
    const { data, error } = await supabase
      .from('appointments')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_reason: reason,
      })
      .eq('tenant_id', DEFAULT_TENANT_ID)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Appointment not found' },
          { status: 404 }
        );
      }
      console.error('Error cancelling appointment:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data, message: 'Appointment cancelled' });
  } catch (error) {
    console.error('Appointment API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

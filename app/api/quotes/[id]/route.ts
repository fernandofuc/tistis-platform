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
// GET /api/quotes/[id] - Get single quote with full details
// =====================================================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: 'Invalid quote ID format' },
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

    // Verify quote access (inline)
    const { data: quoteCheck, error: checkError } = await supabase
      .from('quotes')
      .select('id, tenant_id, status')
      .eq('id', id)
      .single();

    if (checkError || !quoteCheck) {
      return NextResponse.json(
        { error: 'Quote not found' },
        { status: 404 }
      );
    }

    const quoteCheckData = quoteCheck as { id: string; tenant_id: string; status: string };

    if (!isServiceCall && quoteCheckData.tenant_id !== userTenantId) {
      return NextResponse.json(
        { error: 'Access denied to this quote' },
        { status: 403 }
      );
    }

    const { data, error } = await supabase
      .from('quotes')
      .select(`
        *,
        patient:patients!patient_id(
          id, patient_number, first_name, last_name, phone, email,
          address_street, address_city, address_state, address_postal_code
        ),
        lead:leads!lead_id(id, first_name, last_name, full_name, phone, email, classification, interested_services),
        created_by_user:staff!created_by_staff_id(id, first_name, last_name, email),
        quote_items(
          id, service_id, service_name, description, quantity, unit_price,
          discount_percentage, discount_amount, subtotal, sort_order
        ),
        quote_payment_plans(
          id, plan_name, number_of_payments, payment_frequency, down_payment,
          monthly_payment, total_amount, interest_rate, is_default
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching quote:', error);
      return NextResponse.json(
        { error: 'Failed to fetch quote', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ quote: data });
  } catch (error) {
    console.error('Error in GET /api/quotes/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =====================================================
// PATCH /api/quotes/[id] - Update quote
// =====================================================
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: 'Invalid quote ID format' },
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

    // Verify quote access (inline)
    const { data: quoteCheck, error: checkError } = await supabase
      .from('quotes')
      .select('id, tenant_id, status')
      .eq('id', id)
      .single();

    if (checkError || !quoteCheck) {
      return NextResponse.json(
        { error: 'Quote not found' },
        { status: 404 }
      );
    }

    const quoteCheckData = quoteCheck as { id: string; tenant_id: string; status: string };

    if (!isServiceCall && quoteCheckData.tenant_id !== userTenantId) {
      return NextResponse.json(
        { error: 'Access denied to this quote' },
        { status: 403 }
      );
    }

    const currentStatus = quoteCheckData.status;

    // Cannot modify sent/accepted/rejected quotes (only certain fields)
    const lockedStatuses = ['sent', 'accepted', 'rejected', 'expired'];
    const isLocked = lockedStatuses.includes(currentStatus);

    const allowedFields = isLocked
      ? ['status', 'notes'] // Only allow status changes and notes for locked quotes
      : [
          'patient_id',
          'lead_id',
          'status',
          'valid_until',
          'currency',
          'discount_percentage',
          'discount_amount',
          'tax_percentage',
          'notes',
          'terms_and_conditions',
        ];

    const updateData: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (typeof body[field] === 'string' && ['notes', 'terms_and_conditions'].includes(field)) {
          updateData[field] = body[field].trim();
        } else {
          updateData[field] = body[field];
        }
      }
    }

    // Validate status transitions
    if (body.status) {
      const validTransitions: Record<string, string[]> = {
        draft: ['sent', 'cancelled'],
        sent: ['accepted', 'rejected', 'expired', 'draft'],
        accepted: ['cancelled'],
        rejected: ['draft'],
        expired: ['draft'],
        cancelled: ['draft'],
      };

      const allowed = validTransitions[currentStatus] || [];
      if (!allowed.includes(body.status)) {
        return NextResponse.json(
          { error: `Cannot transition from ${currentStatus} to ${body.status}` },
          { status: 400 }
        );
      }

      // Set sent_at when transitioning to sent
      if (body.status === 'sent' && currentStatus !== 'sent') {
        updateData.sent_at = new Date().toISOString();
      }

      // Set accepted_at when transitioning to accepted
      if (body.status === 'accepted') {
        updateData.accepted_at = new Date().toISOString();
      }
    }

    // Validate patient_id XOR lead_id
    if (updateData.patient_id !== undefined || updateData.lead_id !== undefined) {
      const hasPatient = updateData.patient_id !== null && updateData.patient_id !== undefined;
      const hasLead = updateData.lead_id !== null && updateData.lead_id !== undefined;

      if (hasPatient && hasLead) {
        return NextResponse.json(
          { error: 'Quote cannot have both patient_id and lead_id' },
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

    updateData.updated_by = user?.id || body.updated_by || null;

    const { data, error } = await supabase
      .from('quotes')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        patient:patients!patient_id(id, patient_number, first_name, last_name, phone, email),
        lead:leads!lead_id(id, first_name, last_name, full_name, phone, email, classification),
        quote_items(id, service_name, quantity, unit_price, subtotal)
      `)
      .single();

    if (error) {
      console.error('Error updating quote:', error);
      return NextResponse.json(
        { error: 'Failed to update quote', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ quote: data });
  } catch (error) {
    console.error('Error in PATCH /api/quotes/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =====================================================
// DELETE /api/quotes/[id] - Cancel quote (soft delete)
// =====================================================
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: 'Invalid quote ID format' },
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

    // Only admin/receptionist can cancel quotes
    if (!isServiceCall && role && !['admin', 'receptionist', 'super_admin'].includes(role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to cancel quotes' },
        { status: 403 }
      );
    }

    // Verify quote access (inline)
    const { data: quoteCheck, error: checkError } = await supabase
      .from('quotes')
      .select('id, tenant_id, status')
      .eq('id', id)
      .single();

    if (checkError || !quoteCheck) {
      return NextResponse.json(
        { error: 'Quote not found' },
        { status: 404 }
      );
    }

    const quoteCheckData = quoteCheck as { id: string; tenant_id: string; status: string };

    if (!isServiceCall && quoteCheckData.tenant_id !== userTenantId) {
      return NextResponse.json(
        { error: 'Access denied to this quote' },
        { status: 403 }
      );
    }

    // Cannot cancel already accepted quotes
    if (quoteCheckData.status === 'accepted') {
      return NextResponse.json(
        { error: 'Cannot cancel an accepted quote' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('quotes')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error cancelling quote:', error);
      return NextResponse.json(
        { error: 'Failed to cancel quote', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Quote cancelled successfully',
      quote: data,
    });
  } catch (error) {
    console.error('Error in DELETE /api/quotes/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =====================================================
// TIS TIS PLATFORM - Invoices API Route
// CRUD operations for invoices
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getInvoiceService } from '@/src/features/invoicing';
import type { CreateInvoiceRequest, InvoiceStatus } from '@/src/features/invoicing/types';

// ======================
// TYPES
// ======================

interface UserRole {
  tenant_id: string;
  role: string;
}

// ======================
// HELPERS
// ======================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getTenantFromUser(supabase: SupabaseClient<any>, userId: string): Promise<UserRole | null> {
  const { data: userRole, error } = await supabase
    .from('user_roles')
    .select('tenant_id, role')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();

  if (error || !userRole) {
    return null;
  }

  return userRole as UserRole;
}

// ======================
// POST - Create a new invoice
// ======================

export async function POST(request: NextRequest) {
  try {
    // Get authorization
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];

    // Create Supabase client with user token
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get tenant
    const userRole = await getTenantFromUser(supabase, user.id);
    if (!userRole) {
      return NextResponse.json({ error: 'No tenant found for user' }, { status: 403 });
    }

    // Parse request body
    const body: CreateInvoiceRequest = await request.json();

    // Validate required fields
    if (!body.branch_id) {
      return NextResponse.json({ error: 'branch_id is required' }, { status: 400 });
    }
    if (!body.customer_rfc) {
      return NextResponse.json({ error: 'customer_rfc is required' }, { status: 400 });
    }
    if (!body.customer_nombre) {
      return NextResponse.json({ error: 'customer_nombre is required' }, { status: 400 });
    }
    if (!body.customer_codigo_postal) {
      return NextResponse.json({ error: 'customer_codigo_postal is required' }, { status: 400 });
    }
    if (!body.customer_email) {
      return NextResponse.json({ error: 'customer_email is required' }, { status: 400 });
    }
    if (!body.items || body.items.length === 0) {
      return NextResponse.json({ error: 'At least one item is required' }, { status: 400 });
    }

    // Create invoice
    const invoiceService = getInvoiceService();
    const invoice = await invoiceService.createInvoice(userRole.tenant_id, body);

    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    console.error('Error creating invoice:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ======================
// GET - List invoices
// ======================

export async function GET(request: NextRequest) {
  try {
    // Get authorization
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];

    // Create Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get tenant
    const userRole = await getTenantFromUser(supabase, user.id);
    if (!userRole) {
      return NextResponse.json({ error: 'No tenant found for user' }, { status: 403 });
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const options = {
      branch_id: searchParams.get('branch_id') || undefined,
      status: (searchParams.get('status') as InvoiceStatus) || undefined,
      start_date: searchParams.get('start_date') || undefined,
      end_date: searchParams.get('end_date') || undefined,
      search: searchParams.get('search') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0,
    };

    // Get invoices
    const invoiceService = getInvoiceService();
    const result = await invoiceService.getInvoices(userRole.tenant_id, options);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error listing invoices:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ======================
// PATCH - Update invoice status
// ======================

export async function PATCH(request: NextRequest) {
  try {
    // Get authorization
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];

    // Create Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { invoice_id, status, error_message, cancel_motivo, cancel_sustitucion } = body;

    if (!invoice_id) {
      return NextResponse.json({ error: 'invoice_id is required' }, { status: 400 });
    }

    const invoiceService = getInvoiceService();

    // Handle cancellation
    if (status === 'cancelada') {
      if (!cancel_motivo) {
        return NextResponse.json({ error: 'cancel_motivo is required for cancellation' }, { status: 400 });
      }
      const invoice = await invoiceService.cancelInvoice(invoice_id, cancel_motivo, cancel_sustitucion);
      return NextResponse.json(invoice);
    }

    // Update status
    const invoice = await invoiceService.updateStatus(invoice_id, status, error_message);
    return NextResponse.json(invoice);
  } catch (error) {
    console.error('Error updating invoice:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

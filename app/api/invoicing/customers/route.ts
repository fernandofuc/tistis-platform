// =====================================================
// TIS TIS PLATFORM - Customers API Route
// CRUD operations for customer fiscal data
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getInvoiceService, validateRFC } from '@/src/features/invoicing';

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
// POST - Create or update customer fiscal data
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
    const body = await request.json();

    // Validate required fields
    if (!body.rfc) {
      return NextResponse.json({ error: 'rfc is required' }, { status: 400 });
    }
    if (!body.nombre_razon_social) {
      return NextResponse.json({ error: 'nombre_razon_social is required' }, { status: 400 });
    }
    if (!body.codigo_postal) {
      return NextResponse.json({ error: 'codigo_postal is required' }, { status: 400 });
    }
    if (!body.email) {
      return NextResponse.json({ error: 'email is required' }, { status: 400 });
    }

    // Validate RFC format
    const rfcValidation = validateRFC(body.rfc);
    if (!rfcValidation.valid) {
      return NextResponse.json(
        { error: `RFC inválido: ${rfcValidation.errors?.join(', ')}` },
        { status: 400 }
      );
    }

    // Create/update customer
    const invoiceService = getInvoiceService();
    const customer = await invoiceService.upsertCustomer({
      tenant_id: userRole.tenant_id,
      rfc: body.rfc,
      nombre_razon_social: body.nombre_razon_social,
      codigo_postal: body.codigo_postal,
      email: body.email,
      calle: body.calle,
      numero_exterior: body.numero_exterior,
      numero_interior: body.numero_interior,
      colonia: body.colonia,
      municipio: body.municipio,
      estado: body.estado,
      telefono: body.telefono,
      regimen_fiscal: body.regimen_fiscal || '616',
      uso_cfdi_preferido: body.uso_cfdi_preferido || 'G03',
      lead_id: body.lead_id,
    });

    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    console.error('Error creating customer:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ======================
// GET - List customers or get by RFC
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

    const invoiceService = getInvoiceService();
    const searchParams = request.nextUrl.searchParams;

    // Check if looking for specific RFC
    const rfc = searchParams.get('rfc');
    if (rfc) {
      const customer = await invoiceService.getCustomerByRFC(userRole.tenant_id, rfc);
      if (!customer) {
        return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
      }
      return NextResponse.json(customer);
    }

    // List customers
    const options = {
      search: searchParams.get('search') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0,
    };

    const result = await invoiceService.getCustomers(userRole.tenant_id, options);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error listing customers:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ======================
// Validate RFC endpoint
// ======================

export async function OPTIONS(request: NextRequest) {
  const rfc = request.nextUrl.searchParams.get('rfc');

  if (!rfc) {
    return NextResponse.json({ error: 'rfc parameter is required' }, { status: 400 });
  }

  const validation = validateRFC(rfc);
  return NextResponse.json(validation);
}

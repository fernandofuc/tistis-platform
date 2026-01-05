// =====================================================
// TIS TIS PLATFORM - Inventory Suppliers API
// GET: List suppliers, POST: Create supplier
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function getUserAndTenant(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: 'No autorizado', status: 401 };
  }
  const token = authHeader.substring(7);

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) {
    return { error: 'Token inválido', status: 401 };
  }

  const { data: userRole } = await supabase
    .from('user_roles')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single();

  if (!userRole) {
    return { error: 'Sin tenant asociado', status: 403 };
  }

  return { user, userRole, supabase };
}

// ======================
// GET - List Suppliers
// ======================
export async function GET(request: NextRequest) {
  try {
    const result = await getUserAndTenant(request);
    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const { userRole, supabase } = result;
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const activeOnly = searchParams.get('active_only') !== 'false';

    let query = supabase
      .from('inventory_suppliers')
      .select('*')
      .eq('tenant_id', userRole.tenant_id)
      .is('deleted_at', null)
      .order('name', { ascending: true });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,contact_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data: suppliers, error } = await query;

    if (error) {
      console.error('Error fetching suppliers:', error);
      return NextResponse.json({ success: false, error: 'Error al obtener proveedores' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: suppliers });

  } catch (error) {
    console.error('Get suppliers error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

// ======================
// POST - Create Supplier
// ======================
export async function POST(request: NextRequest) {
  try {
    const result = await getUserAndTenant(request);
    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const { userRole, supabase } = result;

    if (!['owner', 'admin', 'manager'].includes(userRole.role)) {
      return NextResponse.json({ success: false, error: 'Sin permisos para crear proveedores' }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      code,
      tax_id,
      contact_name,
      email,
      phone,
      mobile,
      whatsapp,
      website,
      address,
      city,
      state,
      postal_code,
      country,
      payment_terms,
      credit_limit,
      currency,
      categories,
      supplied_item_ids,
      delivery_branch_ids,
      rating,
      notes,
      is_active,
    } = body;

    if (!name) {
      return NextResponse.json({ success: false, error: 'El nombre es requerido' }, { status: 400 });
    }

    const { data: supplier, error } = await supabase
      .from('inventory_suppliers')
      .insert({
        tenant_id: userRole.tenant_id,
        name,
        code,
        tax_id,
        contact_name,
        email,
        phone,
        mobile,
        whatsapp,
        website,
        address,
        city,
        state,
        postal_code,
        country: country || 'México',
        payment_terms,
        credit_limit,
        currency: currency || 'MXN',
        categories: categories || [],
        supplied_item_ids: supplied_item_ids || [],
        delivery_branch_ids: delivery_branch_ids || [],
        rating,
        notes,
        is_active: is_active !== false,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating supplier:', error);
      return NextResponse.json({ success: false, error: 'Error al crear proveedor' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: supplier }, { status: 201 });

  } catch (error) {
    console.error('Create supplier error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

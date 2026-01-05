// =====================================================
// TIS TIS PLATFORM - Inventory Suppliers API
// GET: List suppliers, POST: Create supplier
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import {
  getUserAndTenant,
  isAuthError,
  errorResponse,
  successResponse,
  canWrite,
} from '@/src/lib/api/auth-helper';

// ======================
// GET - List Suppliers
// ======================
export async function GET(request: NextRequest) {
  try {
    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { userRole, supabase } = auth;
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
      return errorResponse('Error al obtener proveedores', 500);
    }

    return successResponse(suppliers);

  } catch (error) {
    console.error('Get suppliers error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

// ======================
// POST - Create Supplier
// ======================
export async function POST(request: NextRequest) {
  try {
    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { userRole, supabase } = auth;

    if (!canWrite(userRole.role)) {
      return errorResponse('Sin permisos para crear proveedores', 403);
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
      return errorResponse('El nombre es requerido', 400);
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
      return errorResponse('Error al crear proveedor', 500);
    }

    return successResponse(supplier, 201);

  } catch (error) {
    console.error('Create supplier error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

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
  isValidUUID,
} from '@/src/lib/api/auth-helper';
import { sanitizeText, sanitizePrice, sanitizeInteger, LIMITS } from '@/src/lib/api/sanitization-helper';

// Valid currencies
const VALID_CURRENCIES = ['MXN', 'USD', 'EUR'];

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
    const limit = sanitizeInteger(searchParams.get('limit'), 1, LIMITS.MAX_QUERY_LIMIT, 100);

    let query = supabase
      .from('inventory_suppliers')
      .select('*')
      .eq('tenant_id', userRole.tenant_id)
      .is('deleted_at', null)
      .order('name', { ascending: true })
      .limit(limit);

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    if (search) {
      // Sanitize search to prevent SQL-like injection in ilike patterns
      const sanitizedSearch = search.replace(/[%_\\]/g, '\\$&');
      query = query.or(`name.ilike.%${sanitizedSearch}%,contact_name.ilike.%${sanitizedSearch}%,email.ilike.%${sanitizedSearch}%`);
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

    // Validate and sanitize required fields
    const name = sanitizeText(body.name, LIMITS.MAX_TEXT_MEDIUM);
    if (!name) {
      return errorResponse('El nombre es requerido', 400);
    }

    // Validate email if provided
    const email = sanitizeText(body.email, 100);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return errorResponse('Email inválido', 400);
    }

    // Validate currency
    const currency = body.currency || 'MXN';
    if (!VALID_CURRENCIES.includes(currency)) {
      return errorResponse(`Moneda inválida. Permitidas: ${VALID_CURRENCIES.join(', ')}`, 400);
    }

    // Sanitize array fields with UUID validation
    let suppliedItemIds: string[] = [];
    if (Array.isArray(body.supplied_item_ids)) {
      suppliedItemIds = body.supplied_item_ids
        .slice(0, 100)
        .filter((id: unknown): id is string => typeof id === 'string' && isValidUUID(id));
    }

    let deliveryBranchIds: string[] = [];
    if (Array.isArray(body.delivery_branch_ids)) {
      deliveryBranchIds = body.delivery_branch_ids
        .slice(0, 50)
        .filter((id: unknown): id is string => typeof id === 'string' && isValidUUID(id));
    }

    let categories: string[] = [];
    if (Array.isArray(body.categories)) {
      categories = body.categories
        .slice(0, 20)
        .map((c: unknown) => sanitizeText(c, 50))
        .filter((c: string | null): c is string => c !== null);
    }

    const { data: supplier, error } = await supabase
      .from('inventory_suppliers')
      .insert({
        tenant_id: userRole.tenant_id,
        name,
        code: sanitizeText(body.code, 50),
        tax_id: sanitizeText(body.tax_id, 30),
        contact_name: sanitizeText(body.contact_name, LIMITS.MAX_TEXT_SHORT),
        email,
        phone: sanitizeText(body.phone, 20),
        mobile: sanitizeText(body.mobile, 20),
        whatsapp: sanitizeText(body.whatsapp, 20),
        website: sanitizeText(body.website, 200),
        address: sanitizeText(body.address, LIMITS.MAX_TEXT_MEDIUM),
        city: sanitizeText(body.city, 100),
        state: sanitizeText(body.state, 100),
        postal_code: sanitizeText(body.postal_code, 20),
        country: sanitizeText(body.country, 100) || 'México',
        payment_terms: sanitizeText(body.payment_terms, LIMITS.MAX_TEXT_MEDIUM),
        credit_limit: sanitizePrice(body.credit_limit),
        currency,
        categories,
        supplied_item_ids: suppliedItemIds,
        delivery_branch_ids: deliveryBranchIds,
        rating: body.rating !== undefined ? sanitizeInteger(body.rating, 1, 5, 3) : null,
        notes: sanitizeText(body.notes, LIMITS.MAX_TEXT_XLARGE),
        is_active: body.is_active !== false,
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

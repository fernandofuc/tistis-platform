// =====================================================
// TIS TIS PLATFORM - Inventory Supplier Detail API
// GET: Get supplier, PUT: Update, DELETE: Soft delete
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import {
  getUserAndTenant,
  isAuthError,
  errorResponse,
  successResponse,
  successMessage,
  isValidUUID,
  canWrite,
  canDelete,
} from '@/src/lib/api/auth-helper';
import { sanitizeText, sanitizePrice, sanitizeInteger, LIMITS } from '@/src/lib/api/sanitization-helper';

// Valid currencies
const VALID_CURRENCIES = ['MXN', 'USD', 'EUR'];

// ======================
// GET - Get Supplier
// ======================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isValidUUID(id)) {
      return errorResponse('ID de proveedor inválido', 400);
    }

    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { userRole, supabase } = auth;

    const { data: supplier, error } = await supabase
      .from('inventory_suppliers')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id)
      .is('deleted_at', null)
      .single();

    if (error || !supplier) {
      return errorResponse('Proveedor no encontrado', 404);
    }

    return successResponse(supplier);

  } catch (error) {
    console.error('Get supplier error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

// ======================
// PUT - Update Supplier
// ======================
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isValidUUID(id)) {
      return errorResponse('ID de proveedor inválido', 400);
    }

    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { userRole, supabase } = auth;

    if (!canWrite(userRole.role)) {
      return errorResponse('Sin permisos para actualizar proveedores', 403);
    }

    const body = await request.json();

    // Build sanitized update data
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // Sanitize text fields
    if (body.name !== undefined) {
      const sanitizedName = sanitizeText(body.name, LIMITS.MAX_TEXT_MEDIUM);
      if (!sanitizedName) {
        return errorResponse('Nombre inválido', 400);
      }
      updateData.name = sanitizedName;
    }

    if (body.code !== undefined) {
      updateData.code = sanitizeText(body.code, 50);
    }

    if (body.tax_id !== undefined) {
      updateData.tax_id = sanitizeText(body.tax_id, 30);
    }

    if (body.contact_name !== undefined) {
      updateData.contact_name = sanitizeText(body.contact_name, LIMITS.MAX_TEXT_SHORT);
    }

    if (body.email !== undefined) {
      // Basic email validation
      const email = sanitizeText(body.email, 100);
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return errorResponse('Email inválido', 400);
      }
      updateData.email = email;
    }

    if (body.phone !== undefined) {
      updateData.phone = sanitizeText(body.phone, 20);
    }

    if (body.mobile !== undefined) {
      updateData.mobile = sanitizeText(body.mobile, 20);
    }

    if (body.whatsapp !== undefined) {
      updateData.whatsapp = sanitizeText(body.whatsapp, 20);
    }

    if (body.website !== undefined) {
      updateData.website = sanitizeText(body.website, 200);
    }

    if (body.address !== undefined) {
      updateData.address = sanitizeText(body.address, LIMITS.MAX_TEXT_MEDIUM);
    }

    if (body.city !== undefined) {
      updateData.city = sanitizeText(body.city, 100);
    }

    if (body.state !== undefined) {
      updateData.state = sanitizeText(body.state, 100);
    }

    if (body.postal_code !== undefined) {
      updateData.postal_code = sanitizeText(body.postal_code, 20);
    }

    if (body.country !== undefined) {
      updateData.country = sanitizeText(body.country, 100);
    }

    if (body.payment_terms !== undefined) {
      updateData.payment_terms = sanitizeText(body.payment_terms, LIMITS.MAX_TEXT_MEDIUM);
    }

    if (body.notes !== undefined) {
      updateData.notes = sanitizeText(body.notes, LIMITS.MAX_TEXT_XLARGE);
    }

    // Sanitize numeric fields
    if (body.credit_limit !== undefined) {
      updateData.credit_limit = sanitizePrice(body.credit_limit);
    }

    if (body.rating !== undefined) {
      updateData.rating = sanitizeInteger(body.rating, 1, 5, 3);
    }

    // Validate currency
    if (body.currency !== undefined) {
      if (!VALID_CURRENCIES.includes(body.currency)) {
        return errorResponse(`Moneda inválida. Permitidas: ${VALID_CURRENCIES.join(', ')}`, 400);
      }
      updateData.currency = body.currency;
    }

    // Boolean fields
    if (body.is_active !== undefined) {
      updateData.is_active = Boolean(body.is_active);
    }

    // Array fields - validate UUIDs
    if (body.supplied_item_ids !== undefined) {
      if (Array.isArray(body.supplied_item_ids)) {
        const validIds = body.supplied_item_ids
          .slice(0, 100)
          .filter((id: unknown): id is string => typeof id === 'string' && isValidUUID(id));
        updateData.supplied_item_ids = validIds;
      }
    }

    if (body.delivery_branch_ids !== undefined) {
      if (Array.isArray(body.delivery_branch_ids)) {
        const validIds = body.delivery_branch_ids
          .slice(0, 50)
          .filter((id: unknown): id is string => typeof id === 'string' && isValidUUID(id));
        updateData.delivery_branch_ids = validIds;
      }
    }

    if (body.categories !== undefined) {
      if (Array.isArray(body.categories)) {
        updateData.categories = body.categories
          .slice(0, 20)
          .map((c: unknown) => sanitizeText(c, 50))
          .filter((c: string | null): c is string => c !== null);
      }
    }

    const { data: supplier, error } = await supabase
      .from('inventory_suppliers')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error || !supplier) {
      console.error('Error updating supplier:', error);
      return errorResponse('Error al actualizar proveedor', 500);
    }

    return successResponse(supplier);

  } catch (error) {
    console.error('Update supplier error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

// ======================
// DELETE - Soft Delete Supplier
// ======================
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isValidUUID(id)) {
      return errorResponse('ID de proveedor inválido', 400);
    }

    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { userRole, supabase } = auth;

    if (!canDelete(userRole.role)) {
      return errorResponse('Sin permisos para eliminar proveedores', 403);
    }

    const { error } = await supabase
      .from('inventory_suppliers')
      .update({
        deleted_at: new Date().toISOString(),
        is_active: false,
      })
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id);

    if (error) {
      console.error('Error deleting supplier:', error);
      return errorResponse('Error al eliminar proveedor', 500);
    }

    return successMessage('Proveedor eliminado');

  } catch (error) {
    console.error('Delete supplier error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

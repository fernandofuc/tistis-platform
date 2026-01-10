// =====================================================
// TIS TIS PLATFORM - Inventory Category Detail API
// GET: Get category, PUT: Update, DELETE: Soft delete
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
import { sanitizeText, sanitizeColor, LIMITS } from '@/src/lib/api/sanitization-helper';

// ======================
// GET - Get Category
// ======================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isValidUUID(id)) {
      return errorResponse('ID de categoría inválido', 400);
    }

    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { userRole, supabase } = auth;

    const { data: category, error } = await supabase
      .from('inventory_categories')
      .select(`
        *,
        items:inventory_items(id, name, sku, current_stock, minimum_stock, unit, is_active)
      `)
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id)
      .is('deleted_at', null)
      .single();

    if (error || !category) {
      return errorResponse('Categoría no encontrada', 404);
    }

    return successResponse(category);

  } catch (error) {
    console.error('Get category error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

// ======================
// PUT - Update Category
// ======================
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isValidUUID(id)) {
      return errorResponse('ID de categoría inválido', 400);
    }

    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { userRole, supabase } = auth;

    if (!canWrite(userRole.role)) {
      return errorResponse('Sin permisos para actualizar categorías', 403);
    }

    const body = await request.json();

    // Build sanitized update data using whitelist approach
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
      // Generate slug from name
      updateData.slug = sanitizedName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }

    if (body.description !== undefined) {
      updateData.description = sanitizeText(body.description, LIMITS.MAX_TEXT_LONG);
    }

    // Validate and sanitize color
    if (body.color !== undefined) {
      updateData.color = sanitizeColor(body.color);
    }

    // Validate branch_id
    if (body.branch_id !== undefined) {
      if (body.branch_id !== null && !isValidUUID(body.branch_id)) {
        return errorResponse('ID de sucursal inválido', 400);
      }
      updateData.branch_id = body.branch_id;
    }

    // Boolean fields
    if (body.is_active !== undefined) {
      updateData.is_active = Boolean(body.is_active);
    }

    const { data: category, error } = await supabase
      .from('inventory_categories')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error || !category) {
      console.error('Error updating category:', error);
      return errorResponse('Error al actualizar categoría', 500);
    }

    return successResponse(category);

  } catch (error) {
    console.error('Update category error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

// ======================
// DELETE - Soft Delete Category
// ======================
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isValidUUID(id)) {
      return errorResponse('ID de categoría inválido', 400);
    }

    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { userRole, supabase } = auth;

    if (!canDelete(userRole.role)) {
      return errorResponse('Sin permisos para eliminar categorías', 403);
    }

    // Check if category has items
    const { count } = await supabase
      .from('inventory_items')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', id)
      .is('deleted_at', null);

    if (count && count > 0) {
      return errorResponse(`No se puede eliminar: hay ${count} items en esta categoría`, 400);
    }

    const { error } = await supabase
      .from('inventory_categories')
      .update({
        deleted_at: new Date().toISOString(),
        is_active: false,
      })
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id);

    if (error) {
      console.error('Error deleting category:', error);
      return errorResponse('Error al eliminar categoría', 500);
    }

    return successMessage('Categoría eliminada');

  } catch (error) {
    console.error('Delete category error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

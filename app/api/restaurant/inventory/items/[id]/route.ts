// =====================================================
// TIS TIS PLATFORM - Inventory Item Detail API
// GET: Get item, PUT: Update, DELETE: Soft delete
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

// Allowed fields for update (whitelist approach)
const ALLOWED_UPDATE_FIELDS = [
  'name', 'sku', 'description', 'category_id', 'item_type', 'unit',
  'unit_cost', 'minimum_stock', 'maximum_stock', 'reorder_quantity',
  'storage_location', 'storage_type', 'is_perishable', 'default_shelf_life_days',
  'track_expiration', 'preferred_supplier_id', 'image_url', 'allergens', 'is_active',
  'branch_id',
];

// Valid item types
const VALID_ITEM_TYPES = ['ingredient', 'product', 'supply', 'packaging'];
const VALID_STORAGE_TYPES = ['dry', 'refrigerated', 'frozen', 'room_temp'];

// ======================
// GET - Get Item
// ======================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isValidUUID(id)) {
      return errorResponse('ID de item inválido', 400);
    }

    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { userRole, supabase } = auth;

    const { data: item, error } = await supabase
      .from('inventory_items')
      .select(`
        *,
        category:inventory_categories(id, name, color),
        supplier:inventory_suppliers(id, name, contact_name, phone)
      `)
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id)
      .is('deleted_at', null)
      .single();

    if (error || !item) {
      return errorResponse('Item no encontrado', 404);
    }

    // Get active batches for this item
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branch_id');

    if (branchId && isValidUUID(branchId)) {
      const { data: batches } = await supabase
        .from('inventory_batches')
        .select('*')
        .eq('item_id', id)
        .eq('branch_id', branchId)
        .in('status', ['available', 'reserved'])
        .gt('current_quantity', 0)
        .order('expiration_date', { ascending: true, nullsFirst: false });

      return successResponse({ ...item, batches: batches || [] });
    }

    return successResponse(item);

  } catch (error) {
    console.error('Get item error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

// ======================
// PUT - Update Item
// ======================
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isValidUUID(id)) {
      return errorResponse('ID de item inválido', 400);
    }

    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { userRole, supabase } = auth;

    if (!canWrite(userRole.role)) {
      return errorResponse('Sin permisos para actualizar items', 403);
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
    }

    if (body.sku !== undefined) {
      updateData.sku = sanitizeText(body.sku, 50);
    }

    if (body.description !== undefined) {
      updateData.description = sanitizeText(body.description, LIMITS.MAX_TEXT_XLARGE);
    }

    if (body.storage_location !== undefined) {
      updateData.storage_location = sanitizeText(body.storage_location, 100);
    }

    // Sanitize numeric fields with limits
    if (body.unit_cost !== undefined) {
      updateData.unit_cost = sanitizePrice(body.unit_cost);
    }

    if (body.minimum_stock !== undefined) {
      updateData.minimum_stock = sanitizeInteger(body.minimum_stock, 0, 999999, 0);
    }

    if (body.maximum_stock !== undefined) {
      updateData.maximum_stock = sanitizeInteger(body.maximum_stock, 0, 999999, 0);
    }

    if (body.reorder_quantity !== undefined) {
      updateData.reorder_quantity = sanitizeInteger(body.reorder_quantity, 0, 99999, 0);
    }

    if (body.default_shelf_life_days !== undefined) {
      updateData.default_shelf_life_days = sanitizeInteger(body.default_shelf_life_days, 0, 3650, 0);
    }

    // Validate enum fields
    if (body.item_type !== undefined) {
      if (!VALID_ITEM_TYPES.includes(body.item_type)) {
        return errorResponse(`Tipo de item inválido. Permitidos: ${VALID_ITEM_TYPES.join(', ')}`, 400);
      }
      updateData.item_type = body.item_type;
    }

    if (body.storage_type !== undefined) {
      if (!VALID_STORAGE_TYPES.includes(body.storage_type)) {
        return errorResponse(`Tipo de almacenamiento inválido. Permitidos: ${VALID_STORAGE_TYPES.join(', ')}`, 400);
      }
      updateData.storage_type = body.storage_type;
    }

    // Validate UUID fields and verify they belong to the same tenant
    if (body.category_id !== undefined) {
      if (body.category_id !== null) {
        if (!isValidUUID(body.category_id)) {
          return errorResponse('ID de categoría inválido', 400);
        }
        // Verify category belongs to same tenant
        const { data: category } = await supabase
          .from('inventory_categories')
          .select('id')
          .eq('id', body.category_id)
          .eq('tenant_id', userRole.tenant_id)
          .is('deleted_at', null)
          .single();
        if (!category) {
          return errorResponse('Categoría no encontrada o no pertenece a este tenant', 400);
        }
      }
      updateData.category_id = body.category_id;
    }

    if (body.preferred_supplier_id !== undefined) {
      if (body.preferred_supplier_id !== null) {
        if (!isValidUUID(body.preferred_supplier_id)) {
          return errorResponse('ID de proveedor inválido', 400);
        }
        // Verify supplier belongs to same tenant
        const { data: supplier } = await supabase
          .from('inventory_suppliers')
          .select('id')
          .eq('id', body.preferred_supplier_id)
          .eq('tenant_id', userRole.tenant_id)
          .is('deleted_at', null)
          .single();
        if (!supplier) {
          return errorResponse('Proveedor no encontrado o no pertenece a este tenant', 400);
        }
      }
      updateData.preferred_supplier_id = body.preferred_supplier_id;
    }

    if (body.branch_id !== undefined) {
      if (body.branch_id !== null) {
        if (!isValidUUID(body.branch_id)) {
          return errorResponse('ID de sucursal inválido', 400);
        }
        // Verify branch belongs to same tenant
        const { data: branch } = await supabase
          .from('branches')
          .select('id')
          .eq('id', body.branch_id)
          .eq('tenant_id', userRole.tenant_id)
          .single();
        if (!branch) {
          return errorResponse('Sucursal no encontrada o no pertenece a este tenant', 400);
        }
      }
      updateData.branch_id = body.branch_id;
    }

    // Boolean fields
    if (body.is_perishable !== undefined) {
      updateData.is_perishable = Boolean(body.is_perishable);
    }

    if (body.track_expiration !== undefined) {
      updateData.track_expiration = Boolean(body.track_expiration);
    }

    if (body.is_active !== undefined) {
      updateData.is_active = Boolean(body.is_active);
    }

    // Simple string fields (sanitized as text)
    if (body.unit !== undefined) {
      const sanitizedUnit = sanitizeText(body.unit, 20);
      if (sanitizedUnit) {
        updateData.unit = sanitizedUnit;
      }
    }

    if (body.image_url !== undefined) {
      updateData.image_url = sanitizeText(body.image_url, 500);
    }

    // Array field - allergens
    if (body.allergens !== undefined) {
      if (Array.isArray(body.allergens)) {
        updateData.allergens = body.allergens
          .slice(0, 20)
          .map((a: unknown) => sanitizeText(a, 50))
          .filter((a: string | null): a is string => a !== null);
      }
    }

    const { data: item, error } = await supabase
      .from('inventory_items')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id)
      .is('deleted_at', null)
      .select(`
        *,
        category:inventory_categories(id, name, color),
        supplier:inventory_suppliers(id, name)
      `)
      .single();

    if (error || !item) {
      console.error('Error updating item:', error);
      return errorResponse('Error al actualizar item', 500);
    }

    return successResponse(item);

  } catch (error) {
    console.error('Update item error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

// ======================
// DELETE - Soft Delete Item
// ======================
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isValidUUID(id)) {
      return errorResponse('ID de item inválido', 400);
    }

    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { userRole, supabase } = auth;

    if (!canDelete(userRole.role)) {
      return errorResponse('Sin permisos para eliminar items', 403);
    }

    // Check if item is used in recipes
    const { count: recipeCount } = await supabase
      .from('recipe_ingredients')
      .select('id', { count: 'exact', head: true })
      .eq('inventory_item_id', id);

    if (recipeCount && recipeCount > 0) {
      return errorResponse(`No se puede eliminar: este item se usa en ${recipeCount} recetas`, 400);
    }

    const { error } = await supabase
      .from('inventory_items')
      .update({
        deleted_at: new Date().toISOString(),
        is_active: false,
      })
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id);

    if (error) {
      console.error('Error deleting item:', error);
      return errorResponse('Error al eliminar item', 500);
    }

    return successMessage('Item eliminado');

  } catch (error) {
    console.error('Delete item error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

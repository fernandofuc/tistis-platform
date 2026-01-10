// =====================================================
// TIS TIS PLATFORM - Restaurant Menu Items API - Single Item
// GET: Get item, PUT: Update item, DELETE: Delete item, PATCH: Quick actions
// Schema: restaurant_menu_items (088_RESTAURANT_VERTICAL_SCHEMA.sql)
// IMPORTANT: variants, sizes, add_ons are JSONB columns, NOT separate tables!
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import {
  getUserAndTenant,
  isAuthError,
  errorResponse,
  successResponse,
  successMessage,
  canWrite,
  canDelete,
  isValidUUID
} from '@/src/lib/api/auth-helper';
import {
  sanitizeText,
  sanitizePrice,
  sanitizeInteger,
  isSafeKey,
  LIMITS,
} from '@/src/lib/api/sanitization-helper';

// Valid currencies
const VALID_CURRENCIES = ['MXN', 'USD', 'EUR'];

// Sanitize JSONB variant structure (H13: prototype pollution protection)
function sanitizeVariant(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const variant = v as Record<string, unknown>;

  // Check for dangerous keys
  for (const key of Object.keys(variant)) {
    if (!isSafeKey(key)) return null;
  }

  return {
    name: sanitizeText(variant.name, 100) || 'Sin nombre',
    price: sanitizePrice(variant.price),
    price_modifier: sanitizePrice(variant.price_modifier),
    is_default: Boolean(variant.is_default),
  };
}

// Sanitize JSONB size structure (H13: prototype pollution protection)
function sanitizeSize(s: unknown): Record<string, unknown> | null {
  if (!s || typeof s !== 'object' || Array.isArray(s)) return null;
  const size = s as Record<string, unknown>;

  // Check for dangerous keys
  for (const key of Object.keys(size)) {
    if (!isSafeKey(key)) return null;
  }

  return {
    name: sanitizeText(size.name, 50) || 'Regular',
    price: sanitizePrice(size.price),
    price_modifier: sanitizePrice(size.price_modifier),
    is_default: Boolean(size.is_default),
  };
}

// Sanitize JSONB add-on structure (H13: prototype pollution protection)
function sanitizeAddOnMenu(a: unknown): Record<string, unknown> | null {
  if (!a || typeof a !== 'object' || Array.isArray(a)) return null;
  const addon = a as Record<string, unknown>;

  // Check for dangerous keys
  for (const key of Object.keys(addon)) {
    if (!isSafeKey(key)) return null;
  }

  return {
    name: sanitizeText(addon.name, 100) || 'Extra',
    price: sanitizePrice(addon.price),
    max_quantity: sanitizeInteger(addon.max_quantity, 1, 10, 1),
  };
}

// ======================
// GET - Get Single Item
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
    const tenantId = userRole.tenant_id;

    const { data: item, error: itemError } = await supabase
      .from('restaurant_menu_items')
      .select(`
        id,
        tenant_id,
        category_id,
        name,
        slug,
        description,
        short_description,
        price,
        price_lunch,
        price_happy_hour,
        currency,
        variants,
        sizes,
        add_ons,
        calories,
        protein_g,
        carbs_g,
        fat_g,
        allergens,
        is_vegetarian,
        is_vegan,
        is_gluten_free,
        is_spicy,
        spice_level,
        is_new,
        is_house_special,
        is_chef_recommendation,
        prep_time_minutes,
        cooking_instructions,
        image_url,
        image_gallery,
        is_available,
        available_quantity,
        out_of_stock_until,
        display_order,
        is_featured,
        times_ordered,
        average_rating,
        metadata,
        created_at,
        updated_at,
        category:restaurant_menu_categories(id, name, parent_id)
      `)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (itemError || !item) {
      return errorResponse('Item no encontrado', 404);
    }

    return successResponse(item);

  } catch (error) {
    console.error('Get menu item error:', error);
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
      return errorResponse('Sin permisos para editar items', 403);
    }

    const tenantId = userRole.tenant_id;

    // Verify item exists
    const { data: existingItem, error: fetchError } = await supabase
      .from('restaurant_menu_items')
      .select('id, category_id')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (fetchError || !existingItem) {
      return errorResponse('Item no encontrado', 404);
    }

    const body = await request.json();

    // Build sanitized update data using whitelist approach
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // Validate category_id if changing
    if (body.category_id !== undefined && body.category_id !== existingItem.category_id) {
      if (!isValidUUID(body.category_id)) {
        return errorResponse('category_id inválido', 400);
      }
      const { data: category } = await supabase
        .from('restaurant_menu_categories')
        .select('id')
        .eq('id', body.category_id)
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .single();

      if (!category) {
        return errorResponse('Categoría no encontrada', 404);
      }
      updateData.category_id = body.category_id;
    }

    // Sanitize text fields
    if (body.name !== undefined) {
      const sanitizedName = sanitizeText(body.name, LIMITS.MAX_TEXT_MEDIUM);
      if (!sanitizedName) {
        return errorResponse('name inválido', 400);
      }
      updateData.name = sanitizedName;
    }

    if (body.description !== undefined) {
      updateData.description = sanitizeText(body.description, LIMITS.MAX_TEXT_XLARGE);
    }

    if (body.short_description !== undefined) {
      updateData.short_description = sanitizeText(body.short_description, LIMITS.MAX_TEXT_MEDIUM);
    }

    if (body.cooking_instructions !== undefined) {
      updateData.cooking_instructions = sanitizeText(body.cooking_instructions, LIMITS.MAX_TEXT_XLARGE);
    }

    if (body.image_url !== undefined) {
      updateData.image_url = sanitizeText(body.image_url, 500);
    }

    // Sanitize price fields
    if (body.price !== undefined) {
      const price = sanitizePrice(body.price);
      if (price <= 0) {
        return errorResponse('price debe ser mayor a 0', 400);
      }
      updateData.price = price;
    }

    if (body.price_lunch !== undefined) {
      updateData.price_lunch = sanitizePrice(body.price_lunch);
    }

    if (body.price_happy_hour !== undefined) {
      updateData.price_happy_hour = sanitizePrice(body.price_happy_hour);
    }

    // Validate currency
    if (body.currency !== undefined) {
      if (!VALID_CURRENCIES.includes(body.currency)) {
        return errorResponse(`Moneda inválida. Permitidas: ${VALID_CURRENCIES.join(', ')}`, 400);
      }
      updateData.currency = body.currency;
    }

    // Sanitize integer fields
    if (body.prep_time_minutes !== undefined) {
      updateData.prep_time_minutes = sanitizeInteger(body.prep_time_minutes, 0, 480, 0);
    }

    if (body.calories !== undefined) {
      updateData.calories = sanitizeInteger(body.calories, 0, 10000, 0);
    }

    if (body.protein_g !== undefined) {
      updateData.protein_g = sanitizeInteger(body.protein_g, 0, 1000, 0);
    }

    if (body.carbs_g !== undefined) {
      updateData.carbs_g = sanitizeInteger(body.carbs_g, 0, 1000, 0);
    }

    if (body.fat_g !== undefined) {
      updateData.fat_g = sanitizeInteger(body.fat_g, 0, 1000, 0);
    }

    if (body.spice_level !== undefined) {
      updateData.spice_level = sanitizeInteger(body.spice_level, 0, 5, 0);
    }

    if (body.available_quantity !== undefined) {
      updateData.available_quantity = sanitizeInteger(body.available_quantity, 0, 999999, 0);
    }

    if (body.display_order !== undefined) {
      updateData.display_order = sanitizeInteger(body.display_order, 0, 10000, 0);
    }

    // Boolean fields
    if (body.is_vegetarian !== undefined) {
      updateData.is_vegetarian = Boolean(body.is_vegetarian);
    }
    if (body.is_vegan !== undefined) {
      updateData.is_vegan = Boolean(body.is_vegan);
    }
    if (body.is_gluten_free !== undefined) {
      updateData.is_gluten_free = Boolean(body.is_gluten_free);
    }
    if (body.is_spicy !== undefined) {
      updateData.is_spicy = Boolean(body.is_spicy);
    }
    if (body.is_new !== undefined) {
      updateData.is_new = Boolean(body.is_new);
    }
    if (body.is_house_special !== undefined) {
      updateData.is_house_special = Boolean(body.is_house_special);
    }
    if (body.is_chef_recommendation !== undefined) {
      updateData.is_chef_recommendation = Boolean(body.is_chef_recommendation);
    }
    if (body.is_available !== undefined) {
      updateData.is_available = Boolean(body.is_available);
    }
    if (body.is_featured !== undefined) {
      updateData.is_featured = Boolean(body.is_featured);
    }

    // JSONB arrays - sanitize structure
    if (body.variants !== undefined) {
      if (Array.isArray(body.variants)) {
        updateData.variants = (body.variants as unknown[])
          .slice(0, 20)
          .map((v: unknown) => sanitizeVariant(v))
          .filter((v): v is Record<string, unknown> => v !== null);
      } else {
        updateData.variants = [];
      }
    }

    if (body.sizes !== undefined) {
      if (Array.isArray(body.sizes)) {
        updateData.sizes = (body.sizes as unknown[])
          .slice(0, 10)
          .map((s: unknown) => sanitizeSize(s))
          .filter((s): s is Record<string, unknown> => s !== null);
      } else {
        updateData.sizes = [];
      }
    }

    if (body.add_ons !== undefined) {
      if (Array.isArray(body.add_ons)) {
        updateData.add_ons = (body.add_ons as unknown[])
          .slice(0, 30)
          .map((a: unknown) => sanitizeAddOnMenu(a))
          .filter((a): a is Record<string, unknown> => a !== null);
      } else {
        updateData.add_ons = [];
      }
    }

    // Sanitize allergens array
    if (body.allergens !== undefined) {
      if (Array.isArray(body.allergens)) {
        updateData.allergens = (body.allergens as unknown[])
          .slice(0, 20)
          .map((a: unknown) => sanitizeText(a, 50))
          .filter((a): a is string => a !== null);
      } else {
        updateData.allergens = [];
      }
    }

    // Sanitize image_gallery array
    if (body.image_gallery !== undefined) {
      if (Array.isArray(body.image_gallery)) {
        updateData.image_gallery = (body.image_gallery as unknown[])
          .slice(0, 10)
          .map((url: unknown) => sanitizeText(url, 500))
          .filter((url): url is string => url !== null);
      } else {
        updateData.image_gallery = [];
      }
    }

    // Date field
    if (body.out_of_stock_until !== undefined) {
      if (body.out_of_stock_until === null) {
        updateData.out_of_stock_until = null;
      } else {
        const date = new Date(body.out_of_stock_until);
        if (!isNaN(date.getTime())) {
          updateData.out_of_stock_until = date.toISOString();
        }
      }
    }

    // Update item
    const { data: updatedItem, error: updateError } = await supabase
      .from('restaurant_menu_items')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        category:restaurant_menu_categories(id, name)
      `)
      .single();

    if (updateError) {
      console.error('Error updating menu item:', JSON.stringify(updateError));
      return errorResponse(`Error al actualizar item: ${updateError.message}`, 500);
    }

    return successResponse(updatedItem);

  } catch (error) {
    console.error('Update menu item error:', error);
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

    const tenantId = userRole.tenant_id;

    // Verify item exists
    const { data: item, error: fetchError } = await supabase
      .from('restaurant_menu_items')
      .select('id')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (fetchError || !item) {
      return errorResponse('Item no encontrado', 404);
    }

    // Soft delete item
    const { error: deleteError } = await supabase
      .from('restaurant_menu_items')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting menu item:', JSON.stringify(deleteError));
      return errorResponse(`Error al eliminar item: ${deleteError.message}`, 500);
    }

    return successMessage('Item eliminado');

  } catch (error) {
    console.error('Delete menu item error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

// ======================
// PATCH - Quick Actions
// ======================
export async function PATCH(
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
    const tenantId = userRole.tenant_id;

    // Staff can do quick actions
    if (!['owner', 'admin', 'manager', 'staff'].includes(userRole.role)) {
      return errorResponse('Sin permisos', 403);
    }

    // Verify item exists
    const { data: item, error: fetchError } = await supabase
      .from('restaurant_menu_items')
      .select('id, is_available, is_featured')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (fetchError || !item) {
      return errorResponse('Item no encontrado', 404);
    }

    const body = await request.json();
    const { action } = body;

    // Valid actions
    const validActions = ['toggle_availability', 'toggle_featured', 'set_available', 'set_unavailable'];

    if (!action || !validActions.includes(action)) {
      return errorResponse(`Acción no válida. Permitidas: ${validActions.join(', ')}`, 400);
    }

    let updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    switch (action) {
      case 'toggle_availability':
        updateData.is_available = !item.is_available;
        break;
      case 'toggle_featured':
        updateData.is_featured = !item.is_featured;
        break;
      case 'set_available':
        updateData.is_available = true;
        break;
      case 'set_unavailable':
        updateData.is_available = false;
        break;
    }

    const { data: updatedItem, error: updateError } = await supabase
      .from('restaurant_menu_items')
      .update(updateData)
      .eq('id', id)
      .select('id, name, is_available, is_featured')
      .single();

    if (updateError) {
      console.error('Error updating menu item:', JSON.stringify(updateError));
      return errorResponse(`Error al actualizar item: ${updateError.message}`, 500);
    }

    return successResponse(updatedItem);

  } catch (error) {
    console.error('Patch menu item error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

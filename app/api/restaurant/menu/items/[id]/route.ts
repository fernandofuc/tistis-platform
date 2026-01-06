// =====================================================
// TIS TIS PLATFORM - Restaurant Menu Items API - Single Item
// GET: Get item, PUT: Update item, DELETE: Delete item, PATCH: Quick actions
// Schema: restaurant_menu_items (088_RESTAURANT_VERTICAL_SCHEMA.sql)
// IMPORTANT: variants, sizes, add_ons are JSONB columns, NOT separate tables!
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  getUserAndTenant,
  isAuthError,
  errorResponse,
  successResponse,
  canWrite,
  canDelete,
  isValidUUID
} from '@/src/lib/api/auth-helper';

// ======================
// GET - Get Single Item
// Schema columns include: variants (JSONB), sizes (JSONB), add_ons (JSONB)
// NO separate tables for these - they're embedded in the item
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

    // Get item with schema-correct columns
    // Note: category.parent_id NOT parent_category_id
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

    // variants, sizes, add_ons are already JSONB columns - no extra queries needed!
    return successResponse(item);

  } catch (error: any) {
    console.error('Get menu item error:', error);
    return errorResponse(`Error interno: ${error?.message || 'Unknown'}`, 500);
  }
}

// ======================
// PUT - Update Item
// Schema columns - NO sku, NO cost, NO min_per_order, NO max_per_order
// variants/sizes/add_ons are JSONB columns NOT separate tables
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

    // Validate category_id if changing
    if (body.category_id && body.category_id !== existingItem.category_id) {
      const { data: category, error: catError } = await supabase
        .from('restaurant_menu_categories')
        .select('id')
        .eq('id', body.category_id)
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .single();

      if (catError || !category) {
        return errorResponse('Categoría no encontrada', 404);
      }
    }

    // Prepare update data - SCHEMA-CORRECT columns only
    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      'category_id',
      'name',
      'description',
      'short_description',
      'price',
      'price_lunch',
      'price_happy_hour',
      'currency',
      'image_url',
      'image_gallery',
      'prep_time_minutes',
      'cooking_instructions',
      'calories',
      'protein_g',
      'carbs_g',
      'fat_g',
      'allergens',
      'is_vegetarian',
      'is_vegan',
      'is_gluten_free',
      'is_spicy',
      'spice_level',
      'is_new',
      'is_house_special',
      'is_chef_recommendation',
      'is_available',
      'available_quantity',
      'out_of_stock_until',
      'is_featured',
      'display_order',
      'metadata',
      // JSONB columns - stored directly in the item
      'variants',
      'sizes',
      'add_ons',
    ];

    allowedFields.forEach(field => {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    });

    // Update item
    const { data: updatedItem, error: updateError } = await supabase
      .from('restaurant_menu_items')
      .update(updateData)
      .eq('id', id)
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
        category:restaurant_menu_categories(id, name)
      `)
      .single();

    if (updateError) {
      console.error('Error updating menu item:', JSON.stringify(updateError));
      return errorResponse(`Error al actualizar item: ${updateError.message}`, 500);
    }

    return successResponse(updatedItem);

  } catch (error: any) {
    console.error('Update menu item error:', error);
    return errorResponse(`Error interno: ${error?.message || 'Unknown'}`, 500);
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

    // No need to delete variants/sizes/add_ons - they're JSONB columns in the item!

    return successResponse({ deleted: true });

  } catch (error: any) {
    console.error('Delete menu item error:', error);
    return errorResponse(`Error interno: ${error?.message || 'Unknown'}`, 500);
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

    let updateData: Record<string, unknown> = {};

    switch (action) {
      case 'toggle_availability':
        updateData = { is_available: !item.is_available };
        break;
      case 'toggle_featured':
        updateData = { is_featured: !item.is_featured };
        break;
      case 'set_available':
        updateData = { is_available: true };
        break;
      case 'set_unavailable':
        updateData = { is_available: false };
        break;
      default:
        return errorResponse('Acción no válida', 400);
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

  } catch (error: any) {
    console.error('Patch menu item error:', error);
    return errorResponse(`Error interno: ${error?.message || 'Unknown'}`, 500);
  }
}

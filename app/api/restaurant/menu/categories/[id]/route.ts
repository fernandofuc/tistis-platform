// =====================================================
// TIS TIS PLATFORM - Restaurant Menu Categories API - Single Category
// GET: Get category, PUT: Update category, DELETE: Delete category
// Schema: restaurant_menu_categories (088_RESTAURANT_VERTICAL_SCHEMA.sql)
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
// GET - Get Single Category
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
    const tenantId = userRole.tenant_id;

    // Get category with schema-correct columns
    const { data: category, error: catError } = await supabase
      .from('restaurant_menu_categories')
      .select(`
        id,
        tenant_id,
        branch_id,
        name,
        slug,
        description,
        parent_id,
        available_times,
        available_days,
        icon,
        image_url,
        display_order,
        is_active,
        is_featured,
        metadata,
        created_at,
        updated_at,
        branch:branches(id, name),
        parent:restaurant_menu_categories!parent_id(id, name)
      `)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (catError || !category) {
      return errorResponse('Categoría no encontrada', 404);
    }

    // Get child categories
    const { data: children } = await supabase
      .from('restaurant_menu_categories')
      .select('id, name, slug, display_order, is_active')
      .eq('parent_id', category.id)
      .is('deleted_at', null)
      .order('display_order', { ascending: true });

    // Get items in this category
    const { data: items, count } = await supabase
      .from('restaurant_menu_items')
      .select(`
        id,
        name,
        price,
        image_url,
        is_available,
        is_featured,
        display_order
      `, { count: 'exact' })
      .eq('category_id', category.id)
      .is('deleted_at', null)
      .order('display_order', { ascending: true })
      .limit(20);

    return successResponse({
      ...category,
      children: children || [],
      items: items || [],
      item_count: count || 0,
    });

  } catch (error: any) {
    console.error('Get category error:', error);
    return errorResponse(`Error interno: ${error?.message || 'Unknown'}`, 500);
  }
}

// ======================
// PUT - Update Category
// Schema columns: name, slug, description, parent_id, available_times (JSONB),
// available_days (TEXT[]), icon, image_url, display_order, is_active, is_featured, metadata
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
      return errorResponse('Sin permisos para editar categorías', 403);
    }

    const tenantId = userRole.tenant_id;

    // Verify category exists and belongs to tenant
    const { data: existingCategory, error: fetchError } = await supabase
      .from('restaurant_menu_categories')
      .select('id, parent_id')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (fetchError || !existingCategory) {
      return errorResponse('Categoría no encontrada', 404);
    }

    const body = await request.json();

    // Support both parent_id and parent_category_id from frontend
    const newParentId = body.parent_id ?? body.parent_category_id;

    // Validate parent_id if changing
    if (newParentId !== undefined && newParentId !== existingCategory.parent_id) {
      if (newParentId) {
        // Can't be its own parent
        if (newParentId === id) {
          return errorResponse('Una categoría no puede ser su propio padre', 400);
        }

        // Verify parent exists
        const { data: parentCategory } = await supabase
          .from('restaurant_menu_categories')
          .select('id, parent_id')
          .eq('id', newParentId)
          .eq('tenant_id', tenantId)
          .is('deleted_at', null)
          .single();

        if (!parentCategory) {
          return errorResponse('Categoría padre no encontrada', 404);
        }

        // Prevent circular reference
        if (parentCategory.parent_id === id) {
          return errorResponse('Referencia circular detectada', 400);
        }
      }
    }

    // Prepare update data - SCHEMA-CORRECT columns only
    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      'name',
      'description',
      'parent_id',
      'icon',
      'image_url',
      'display_order',
      'is_active',
      'is_featured',
      'available_days',      // TEXT[]
      'available_times',     // JSONB
      'metadata',            // JSONB
    ];

    allowedFields.forEach(field => {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    });

    // Handle parent_id from parent_category_id
    if (newParentId !== undefined) {
      updateData.parent_id = newParentId;
    }

    // Update category
    const { data: updatedCategory, error: updateError } = await supabase
      .from('restaurant_menu_categories')
      .update(updateData)
      .eq('id', id)
      .select(`
        id,
        tenant_id,
        branch_id,
        name,
        slug,
        description,
        parent_id,
        available_times,
        available_days,
        icon,
        image_url,
        display_order,
        is_active,
        is_featured,
        metadata,
        created_at,
        updated_at,
        branch:branches(id, name),
        parent:restaurant_menu_categories!parent_id(id, name)
      `)
      .single();

    if (updateError) {
      console.error('Error updating category:', JSON.stringify(updateError));
      return errorResponse(`Error al actualizar categoría: ${updateError.message}`, 500);
    }

    return successResponse(updatedCategory);

  } catch (error: any) {
    console.error('Update category error:', error);
    return errorResponse(`Error interno: ${error?.message || 'Unknown'}`, 500);
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

    const tenantId = userRole.tenant_id;

    // Verify category exists
    const { data: category, error: fetchError } = await supabase
      .from('restaurant_menu_categories')
      .select('id')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (fetchError || !category) {
      return errorResponse('Categoría no encontrada', 404);
    }

    // Check if category has children
    const { count: childrenCount } = await supabase
      .from('restaurant_menu_categories')
      .select('*', { count: 'exact', head: true })
      .eq('parent_id', id)
      .is('deleted_at', null);

    if (childrenCount && childrenCount > 0) {
      return errorResponse('No se puede eliminar una categoría con subcategorías', 400);
    }

    // Check if category has items
    const { count: itemsCount } = await supabase
      .from('restaurant_menu_items')
      .select('*', { count: 'exact', head: true })
      .eq('category_id', id)
      .is('deleted_at', null);

    if (itemsCount && itemsCount > 0) {
      return errorResponse('No se puede eliminar una categoría con items. Mueve o elimina los items primero.', 400);
    }

    // Soft delete
    const { error: deleteError } = await supabase
      .from('restaurant_menu_categories')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting category:', JSON.stringify(deleteError));
      return errorResponse(`Error al eliminar categoría: ${deleteError.message}`, 500);
    }

    return successResponse({ deleted: true });

  } catch (error: any) {
    console.error('Delete category error:', error);
    return errorResponse(`Error interno: ${error?.message || 'Unknown'}`, 500);
  }
}

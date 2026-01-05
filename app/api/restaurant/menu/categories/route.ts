// =====================================================
// TIS TIS PLATFORM - Restaurant Menu Categories API
// GET: List categories, POST: Create category
// Schema: restaurant_menu_categories (088_RESTAURANT_VERTICAL_SCHEMA.sql)
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  getUserAndTenant,
  isAuthError,
  errorResponse,
  successResponse,
  canWrite
} from '@/src/lib/api/auth-helper';

// ======================
// GET - List Categories
// ======================
export async function GET(request: NextRequest) {
  try {
    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { userRole, supabase } = auth;
    const tenantId = userRole.tenant_id;

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const branchId = searchParams.get('branch_id');
    const parentId = searchParams.get('parent_id');
    const isActive = searchParams.get('is_active');
    const includeItems = searchParams.get('include_items') === 'true';

    // Build query - Schema columns:
    // id, tenant_id, branch_id, name, slug, description, parent_id,
    // available_times (JSONB), available_days (TEXT[]), icon, image_url,
    // display_order, is_active, is_featured, metadata, created_at, updated_at, deleted_at
    let query = supabase
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
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('display_order', { ascending: true })
      .order('name', { ascending: true });

    // Apply filters
    if (branchId) {
      query = query.eq('branch_id', branchId);
    }
    if (parentId === 'null') {
      query = query.is('parent_id', null);
    } else if (parentId) {
      query = query.eq('parent_id', parentId);
    }
    if (isActive === 'true') {
      query = query.eq('is_active', true);
    } else if (isActive === 'false') {
      query = query.eq('is_active', false);
    }

    const { data: categories, error: categoriesError } = await query;

    if (categoriesError) {
      console.error('Error fetching categories:', JSON.stringify(categoriesError));
      return errorResponse(`Error al cargar categorías: ${categoriesError.message}`, 500);
    }

    // If includeItems, get item count for each category
    let categoriesWithCount = categories || [];
    if (includeItems) {
      categoriesWithCount = await Promise.all(
        (categories || []).map(async (category) => {
          const { count } = await supabase
            .from('restaurant_menu_items')
            .select('*', { count: 'exact', head: true })
            .eq('category_id', category.id)
            .is('deleted_at', null);

          return {
            ...category,
            item_count: count || 0,
          };
        })
      );
    }

    // Build tree structure
    const rootCategories = categoriesWithCount.filter(c => !c.parent_id);
    const childCategories = categoriesWithCount.filter(c => c.parent_id);

    const categoriesTree = rootCategories.map(parent => ({
      ...parent,
      children: childCategories.filter(c => c.parent_id === parent.id),
    }));

    return successResponse({
      categories: categoriesWithCount,
      tree: categoriesTree,
    });

  } catch (error: any) {
    console.error('Categories API error:', error);
    return errorResponse(`Error interno: ${error?.message || 'Unknown'}`, 500);
  }
}

// ======================
// POST - Create Category
// Schema columns: tenant_id, branch_id, name, slug, description, parent_id,
// available_times (JSONB), available_days (TEXT[]), icon, image_url,
// display_order, is_active, is_featured, metadata
// ======================
export async function POST(request: NextRequest) {
  try {
    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { userRole, supabase } = auth;

    // Check permissions
    if (!canWrite(userRole.role)) {
      return errorResponse('Sin permisos para crear categorías', 403);
    }

    const tenantId = userRole.tenant_id;

    // Parse body
    const body = await request.json();
    const {
      branch_id,
      name,
      description,
      parent_category_id,
      parent_id, // Support both names
      icon,
      image_url,
      display_order,
      is_active = true,
      is_featured = false,
      // Schema uses: available_times (JSONB) and available_days (TEXT[])
      available_days, // TEXT[] e.g. ['monday', 'tuesday', ...]
      available_times, // JSONB e.g. {"all_day": true} or {"start": "09:00", "end": "22:00"}
      metadata,
    } = body;

    // Support both parent_id and parent_category_id
    const finalParentId = parent_category_id || parent_id || null;

    // Validate required fields
    if (!name) {
      return errorResponse('El campo name es requerido', 400);
    }

    // branch_id is optional in schema (NULL = aplica a todas las sucursales)
    // but verify it belongs to tenant if provided
    if (branch_id) {
      const { data: branch, error: branchError } = await supabase
        .from('branches')
        .select('id')
        .eq('id', branch_id)
        .eq('tenant_id', tenantId)
        .single();

      if (branchError || !branch) {
        return errorResponse('Sucursal no encontrada', 404);
      }
    }

    // Verify parent category if provided
    if (finalParentId) {
      const { data: parentCategory, error: parentError } = await supabase
        .from('restaurant_menu_categories')
        .select('id')
        .eq('id', finalParentId)
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .single();

      if (parentError || !parentCategory) {
        return errorResponse('Categoría padre no encontrada', 404);
      }
    }

    // Generate slug from name
    const baseSlug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    // Make slug unique by appending number if needed
    let slug = baseSlug;
    let slugCounter = 1;
    while (true) {
      const { data: existingSlug } = await supabase
        .from('restaurant_menu_categories')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('slug', slug)
        .is('deleted_at', null)
        .maybeSingle();

      if (!existingSlug) break;
      slug = `${baseSlug}-${slugCounter++}`;
    }

    // Get max display_order if not provided
    let finalDisplayOrder = display_order;
    if (finalDisplayOrder === undefined) {
      let orderQuery = supabase
        .from('restaurant_menu_categories')
        .select('display_order')
        .eq('tenant_id', tenantId)
        .order('display_order', { ascending: false })
        .limit(1);

      if (branch_id) {
        orderQuery = orderQuery.eq('branch_id', branch_id);
      }

      const { data: maxOrderResult } = await orderQuery.maybeSingle();
      finalDisplayOrder = (maxOrderResult?.display_order || 0) + 1;
    }

    // Insert category with SCHEMA-CORRECT columns
    const insertData: Record<string, any> = {
      tenant_id: tenantId,
      name,
      slug,
      display_order: finalDisplayOrder,
      is_active,
      is_featured,
    };

    // Optional fields
    if (branch_id) insertData.branch_id = branch_id;
    if (description) insertData.description = description;
    if (finalParentId) insertData.parent_id = finalParentId;
    if (icon) insertData.icon = icon;
    if (image_url) insertData.image_url = image_url;
    if (available_days) insertData.available_days = available_days;
    if (available_times) insertData.available_times = available_times;
    if (metadata) insertData.metadata = metadata;

    const { data: newCategory, error: insertError } = await supabase
      .from('restaurant_menu_categories')
      .insert(insertData)
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

    if (insertError) {
      console.error('Error creating category:', JSON.stringify(insertError));
      // Check for specific error codes
      if (insertError.code === '23505') {
        return errorResponse('Ya existe una categoría con ese nombre/slug', 409);
      }
      if (insertError.code === '42P01') {
        return errorResponse('Tabla restaurant_menu_categories no existe', 500);
      }
      return errorResponse(`Error al crear categoría: ${insertError.message}`, 500);
    }

    return successResponse(newCategory);

  } catch (error: any) {
    console.error('Create category error:', error);
    return errorResponse(`Error interno: ${error?.message || 'Unknown'}`, 500);
  }
}

// ======================
// PUT - Reorder Categories
// ======================
export async function PUT(request: NextRequest) {
  try {
    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { userRole, supabase } = auth;

    // Check permissions
    if (!canWrite(userRole.role)) {
      return errorResponse('Sin permisos para reordenar categorías', 403);
    }

    const tenantId = userRole.tenant_id;

    // Parse body - expecting array of { id, display_order }
    const body = await request.json();
    const { categories } = body;

    if (!Array.isArray(categories)) {
      return errorResponse('Se espera un array de categorías con id y display_order', 400);
    }

    // Update each category's display_order
    const updates = await Promise.all(
      categories.map(async (cat: { id: string; display_order: number }) => {
        const { error } = await supabase
          .from('restaurant_menu_categories')
          .update({ display_order: cat.display_order })
          .eq('id', cat.id)
          .eq('tenant_id', tenantId);

        return { id: cat.id, success: !error, error: error?.message };
      })
    );

    const failed = updates.filter(u => !u.success);
    if (failed.length > 0) {
      console.error('Some categories failed to reorder:', JSON.stringify(failed));
    }

    return successResponse({
      updated: updates.filter(u => u.success).length,
      failed: failed.length,
    });

  } catch (error: any) {
    console.error('Reorder categories error:', error);
    return errorResponse(`Error interno: ${error?.message || 'Unknown'}`, 500);
  }
}

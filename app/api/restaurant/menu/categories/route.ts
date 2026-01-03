// =====================================================
// TIS TIS PLATFORM - Restaurant Menu Categories API
// GET: List categories, POST: Create category
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Helper to get user and tenant
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
// GET - List Categories
// ======================
export async function GET(request: NextRequest) {
  try {
    const result = await getUserAndTenant(request);
    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const { userRole, supabase } = result;
    const tenantId = userRole.tenant_id;

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const branchId = searchParams.get('branch_id');
    const parentId = searchParams.get('parent_id');
    const isActive = searchParams.get('is_active');
    const includeItems = searchParams.get('include_items') === 'true';

    // Build query
    let query = supabase
      .from('restaurant_menu_categories')
      .select(`
        *,
        branch:branches(id, name),
        parent:restaurant_menu_categories!parent_category_id(id, name)
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
      query = query.is('parent_category_id', null);
    } else if (parentId) {
      query = query.eq('parent_category_id', parentId);
    }
    if (isActive === 'true') {
      query = query.eq('is_active', true);
    } else if (isActive === 'false') {
      query = query.eq('is_active', false);
    }

    const { data: categories, error: categoriesError } = await query;

    if (categoriesError) {
      console.error('Error fetching categories:', categoriesError);
      return NextResponse.json({ success: false, error: 'Error al cargar categorías' }, { status: 500 });
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
    const rootCategories = categoriesWithCount.filter(c => !c.parent_category_id);
    const childCategories = categoriesWithCount.filter(c => c.parent_category_id);

    const categoriesTree = rootCategories.map(parent => ({
      ...parent,
      children: childCategories.filter(c => c.parent_category_id === parent.id),
    }));

    return NextResponse.json({
      success: true,
      data: {
        categories: categoriesWithCount,
        tree: categoriesTree,
      },
    });

  } catch (error) {
    console.error('Categories API error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

// ======================
// POST - Create Category
// ======================
export async function POST(request: NextRequest) {
  try {
    const result = await getUserAndTenant(request);
    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const { userRole, supabase } = result;

    // Check permissions
    if (!['owner', 'admin', 'manager'].includes(userRole.role)) {
      return NextResponse.json({ success: false, error: 'Sin permisos para crear categorías' }, { status: 403 });
    }

    const tenantId = userRole.tenant_id;

    // Parse body
    const body = await request.json();
    const {
      branch_id,
      name,
      description,
      parent_category_id,
      image_url,
      display_order,
      is_active = true,
      available_days,
      available_start_time,
      available_end_time,
    } = body;

    // Validate required fields
    if (!branch_id || !name) {
      return NextResponse.json({
        success: false,
        error: 'branch_id y name son requeridos',
      }, { status: 400 });
    }

    // Verify branch belongs to tenant
    const { data: branch } = await supabase
      .from('branches')
      .select('id')
      .eq('id', branch_id)
      .eq('tenant_id', tenantId)
      .single();

    if (!branch) {
      return NextResponse.json({ success: false, error: 'Sucursal no encontrada' }, { status: 404 });
    }

    // Verify parent category if provided
    if (parent_category_id) {
      const { data: parentCategory } = await supabase
        .from('restaurant_menu_categories')
        .select('id')
        .eq('id', parent_category_id)
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .single();

      if (!parentCategory) {
        return NextResponse.json({ success: false, error: 'Categoría padre no encontrada' }, { status: 404 });
      }
    }

    // Get max display_order if not provided
    let finalDisplayOrder = display_order;
    if (finalDisplayOrder === undefined) {
      const { data: maxOrderResult } = await supabase
        .from('restaurant_menu_categories')
        .select('display_order')
        .eq('branch_id', branch_id)
        .order('display_order', { ascending: false })
        .limit(1)
        .single();

      finalDisplayOrder = (maxOrderResult?.display_order || 0) + 1;
    }

    // Insert category
    const { data: newCategory, error: insertError } = await supabase
      .from('restaurant_menu_categories')
      .insert({
        tenant_id: tenantId,
        branch_id,
        name,
        description: description || null,
        parent_category_id: parent_category_id || null,
        image_url: image_url || null,
        display_order: finalDisplayOrder,
        is_active,
        available_days: available_days || null,
        available_start_time: available_start_time || null,
        available_end_time: available_end_time || null,
      })
      .select(`
        *,
        branch:branches(id, name),
        parent:restaurant_menu_categories!parent_category_id(id, name)
      `)
      .single();

    if (insertError) {
      console.error('Error creating category:', insertError);
      return NextResponse.json({ success: false, error: 'Error al crear categoría' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: newCategory,
    });

  } catch (error) {
    console.error('Create category error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

// ======================
// PUT - Reorder Categories
// ======================
export async function PUT(request: NextRequest) {
  try {
    const result = await getUserAndTenant(request);
    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const { userRole, supabase } = result;

    // Check permissions
    if (!['owner', 'admin', 'manager'].includes(userRole.role)) {
      return NextResponse.json({ success: false, error: 'Sin permisos para reordenar categorías' }, { status: 403 });
    }

    const tenantId = userRole.tenant_id;

    // Parse body - expecting array of { id, display_order }
    const body = await request.json();
    const { categories } = body;

    if (!Array.isArray(categories)) {
      return NextResponse.json({
        success: false,
        error: 'Se espera un array de categorías con id y display_order',
      }, { status: 400 });
    }

    // Update each category's display_order
    const updates = await Promise.all(
      categories.map(async (cat: { id: string; display_order: number }) => {
        const { error } = await supabase
          .from('restaurant_menu_categories')
          .update({ display_order: cat.display_order })
          .eq('id', cat.id)
          .eq('tenant_id', tenantId);

        return { id: cat.id, success: !error, error };
      })
    );

    const failed = updates.filter(u => !u.success);
    if (failed.length > 0) {
      console.error('Some categories failed to reorder:', failed);
    }

    return NextResponse.json({
      success: true,
      data: {
        updated: updates.filter(u => u.success).length,
        failed: failed.length,
      },
    });

  } catch (error) {
    console.error('Reorder categories error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

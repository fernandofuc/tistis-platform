// =====================================================
// TIS TIS PLATFORM - Restaurant Menu Categories API - Single Category
// GET: Get category, PUT: Update category, DELETE: Delete category
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Helper to get user and verify permissions
async function getUserAndVerify(request: NextRequest, categoryId: string) {
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

  // Verify category belongs to tenant
  const { data: category } = await supabase
    .from('menu_categories')
    .select(`
      *,
      branch:branches(id, name),
      parent:menu_categories!parent_category_id(id, name)
    `)
    .eq('id', categoryId)
    .eq('tenant_id', userRole.tenant_id)
    .is('deleted_at', null)
    .single();

  if (!category) {
    return { error: 'Categoría no encontrada', status: 404 };
  }

  return { user, userRole, category, supabase };
}

// ======================
// GET - Get Single Category
// ======================
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await getUserAndVerify(request, params.id);
    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const { category, supabase, userRole } = result;

    // Get child categories
    const { data: children } = await supabase
      .from('menu_categories')
      .select('id, name, display_order, is_active')
      .eq('parent_category_id', category.id)
      .is('deleted_at', null)
      .order('display_order', { ascending: true });

    // Get items in this category
    const { data: items, count } = await supabase
      .from('menu_items')
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

    return NextResponse.json({
      success: true,
      data: {
        ...category,
        children: children || [],
        items: items || [],
        item_count: count || 0,
      },
    });

  } catch (error) {
    console.error('Get category error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

// ======================
// PUT - Update Category
// ======================
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await getUserAndVerify(request, params.id);
    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const { category, supabase, userRole } = result;

    // Check permissions
    if (!['owner', 'admin', 'manager'].includes(userRole.role)) {
      return NextResponse.json({ success: false, error: 'Sin permisos para editar categorías' }, { status: 403 });
    }

    const body = await request.json();

    // Validate parent_category_id if changing
    if (body.parent_category_id !== undefined && body.parent_category_id !== category.parent_category_id) {
      if (body.parent_category_id) {
        // Can't be its own parent
        if (body.parent_category_id === category.id) {
          return NextResponse.json({
            success: false,
            error: 'Una categoría no puede ser su propio padre',
          }, { status: 400 });
        }

        // Verify parent exists
        const { data: parentCategory } = await supabase
          .from('menu_categories')
          .select('id, parent_category_id')
          .eq('id', body.parent_category_id)
          .eq('tenant_id', userRole.tenant_id)
          .is('deleted_at', null)
          .single();

        if (!parentCategory) {
          return NextResponse.json({ success: false, error: 'Categoría padre no encontrada' }, { status: 404 });
        }

        // Prevent circular reference (parent can't be a child of this category)
        if (parentCategory.parent_category_id === category.id) {
          return NextResponse.json({
            success: false,
            error: 'Referencia circular detectada',
          }, { status: 400 });
        }
      }
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      'name',
      'description',
      'parent_category_id',
      'image_url',
      'display_order',
      'is_active',
      'available_days',
      'available_start_time',
      'available_end_time',
    ];

    allowedFields.forEach(field => {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    });

    // Update category
    const { data: updatedCategory, error: updateError } = await supabase
      .from('menu_categories')
      .update(updateData)
      .eq('id', category.id)
      .select(`
        *,
        branch:branches(id, name),
        parent:menu_categories!parent_category_id(id, name)
      `)
      .single();

    if (updateError) {
      console.error('Error updating category:', updateError);
      return NextResponse.json({ success: false, error: 'Error al actualizar categoría' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: updatedCategory,
    });

  } catch (error) {
    console.error('Update category error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

// ======================
// DELETE - Soft Delete Category
// ======================
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await getUserAndVerify(request, params.id);
    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const { category, supabase, userRole } = result;

    // Check permissions
    if (!['owner', 'admin'].includes(userRole.role)) {
      return NextResponse.json({ success: false, error: 'Sin permisos para eliminar categorías' }, { status: 403 });
    }

    // Check if category has children
    const { count: childrenCount } = await supabase
      .from('menu_categories')
      .select('*', { count: 'exact', head: true })
      .eq('parent_category_id', category.id)
      .is('deleted_at', null);

    if (childrenCount && childrenCount > 0) {
      return NextResponse.json({
        success: false,
        error: 'No se puede eliminar una categoría con subcategorías',
      }, { status: 400 });
    }

    // Check if category has items
    const { count: itemsCount } = await supabase
      .from('menu_items')
      .select('*', { count: 'exact', head: true })
      .eq('category_id', category.id)
      .is('deleted_at', null);

    if (itemsCount && itemsCount > 0) {
      return NextResponse.json({
        success: false,
        error: 'No se puede eliminar una categoría con items. Mueve o elimina los items primero.',
      }, { status: 400 });
    }

    // Soft delete
    const { error: deleteError } = await supabase
      .from('menu_categories')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', category.id);

    if (deleteError) {
      console.error('Error deleting category:', deleteError);
      return NextResponse.json({ success: false, error: 'Error al eliminar categoría' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Delete category error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

// =====================================================
// TIS TIS PLATFORM - Restaurant Menu Items API - Single Item
// GET: Get item, PUT: Update item, DELETE: Delete item
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Helper to get user and verify permissions
async function getUserAndVerify(request: NextRequest, itemId: string) {
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

  // Verify item belongs to tenant
  const { data: item } = await supabase
    .from('menu_items')
    .select(`
      *,
      category:menu_categories(id, name, parent_category_id)
    `)
    .eq('id', itemId)
    .eq('tenant_id', userRole.tenant_id)
    .is('deleted_at', null)
    .single();

  if (!item) {
    return { error: 'Item no encontrado', status: 404 };
  }

  return { user, userRole, item, supabase };
}

// ======================
// GET - Get Single Item
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

    const { item, supabase } = result;

    // Get variants, sizes, and add-ons
    const [variantsResult, sizesResult, addOnsResult] = await Promise.all([
      supabase
        .from('menu_item_variants')
        .select('*')
        .eq('menu_item_id', item.id)
        .is('deleted_at', null)
        .order('display_order', { ascending: true }),
      supabase
        .from('menu_item_sizes')
        .select('*')
        .eq('menu_item_id', item.id)
        .is('deleted_at', null)
        .order('display_order', { ascending: true }),
      supabase
        .from('menu_item_add_ons')
        .select('*')
        .eq('menu_item_id', item.id)
        .is('deleted_at', null)
        .order('display_order', { ascending: true }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        ...item,
        variants: variantsResult.data || [],
        sizes: sizesResult.data || [],
        add_ons: addOnsResult.data || [],
      },
    });

  } catch (error) {
    console.error('Get menu item error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

// ======================
// PUT - Update Item
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

    const { item, supabase, userRole } = result;

    // Check permissions
    if (!['owner', 'admin', 'manager'].includes(userRole.role)) {
      return NextResponse.json({ success: false, error: 'Sin permisos para editar items' }, { status: 403 });
    }

    const tenantId = userRole.tenant_id;
    const body = await request.json();

    // Validate category_id if changing
    if (body.category_id && body.category_id !== item.category_id) {
      const { data: category } = await supabase
        .from('menu_categories')
        .select('id')
        .eq('id', body.category_id)
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .single();

      if (!category) {
        return NextResponse.json({ success: false, error: 'Categoría no encontrada' }, { status: 404 });
      }
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      'category_id',
      'name',
      'description',
      'price',
      'cost',
      'sku',
      'image_url',
      'preparation_time_minutes',
      'calories',
      'allergens',
      'is_vegetarian',
      'is_vegan',
      'is_gluten_free',
      'spice_level',
      'is_available',
      'is_featured',
      'available_start_time',
      'available_end_time',
      'available_days',
      'max_per_order',
      'min_per_order',
      'display_order',
    ];

    allowedFields.forEach(field => {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    });

    // Update item
    const { data: updatedItem, error: updateError } = await supabase
      .from('menu_items')
      .update(updateData)
      .eq('id', item.id)
      .select(`
        *,
        category:menu_categories(id, name)
      `)
      .single();

    if (updateError) {
      console.error('Error updating menu item:', updateError);
      return NextResponse.json({ success: false, error: 'Error al actualizar item' }, { status: 500 });
    }

    // Handle variants update if provided
    if (body.variants !== undefined) {
      // Delete existing variants
      await supabase
        .from('menu_item_variants')
        .update({ deleted_at: new Date().toISOString() })
        .eq('menu_item_id', item.id);

      // Insert new variants
      if (body.variants.length > 0) {
        const variantsToInsert = body.variants.map((v: any, index: number) => ({
          tenant_id: tenantId,
          menu_item_id: item.id,
          name: v.name,
          price_modifier: v.price_modifier || 0,
          is_default: v.is_default || false,
          is_available: v.is_available !== false,
          display_order: v.display_order || index,
        }));

        await supabase.from('menu_item_variants').insert(variantsToInsert);
      }
    }

    // Handle sizes update if provided
    if (body.sizes !== undefined) {
      await supabase
        .from('menu_item_sizes')
        .update({ deleted_at: new Date().toISOString() })
        .eq('menu_item_id', item.id);

      if (body.sizes.length > 0) {
        const sizesToInsert = body.sizes.map((s: any, index: number) => ({
          tenant_id: tenantId,
          menu_item_id: item.id,
          name: s.name,
          price: s.price,
          is_default: s.is_default || false,
          is_available: s.is_available !== false,
          display_order: s.display_order || index,
        }));

        await supabase.from('menu_item_sizes').insert(sizesToInsert);
      }
    }

    // Handle add-ons update if provided
    if (body.add_ons !== undefined) {
      await supabase
        .from('menu_item_add_ons')
        .update({ deleted_at: new Date().toISOString() })
        .eq('menu_item_id', item.id);

      if (body.add_ons.length > 0) {
        const addOnsToInsert = body.add_ons.map((a: any, index: number) => ({
          tenant_id: tenantId,
          menu_item_id: item.id,
          name: a.name,
          price: a.price || 0,
          is_available: a.is_available !== false,
          max_quantity: a.max_quantity || null,
          display_order: a.display_order || index,
        }));

        await supabase.from('menu_item_add_ons').insert(addOnsToInsert);
      }
    }

    // Fetch complete item with extras
    const [variantsResult, sizesResult, addOnsResult] = await Promise.all([
      supabase
        .from('menu_item_variants')
        .select('*')
        .eq('menu_item_id', item.id)
        .is('deleted_at', null)
        .order('display_order', { ascending: true }),
      supabase
        .from('menu_item_sizes')
        .select('*')
        .eq('menu_item_id', item.id)
        .is('deleted_at', null)
        .order('display_order', { ascending: true }),
      supabase
        .from('menu_item_add_ons')
        .select('*')
        .eq('menu_item_id', item.id)
        .is('deleted_at', null)
        .order('display_order', { ascending: true }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        ...updatedItem,
        variants: variantsResult.data || [],
        sizes: sizesResult.data || [],
        add_ons: addOnsResult.data || [],
      },
    });

  } catch (error) {
    console.error('Update menu item error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

// ======================
// DELETE - Soft Delete Item
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

    const { item, supabase, userRole } = result;

    // Check permissions
    if (!['owner', 'admin'].includes(userRole.role)) {
      return NextResponse.json({ success: false, error: 'Sin permisos para eliminar items' }, { status: 403 });
    }

    // Soft delete item
    const { error: deleteError } = await supabase
      .from('menu_items')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', item.id);

    if (deleteError) {
      console.error('Error deleting menu item:', deleteError);
      return NextResponse.json({ success: false, error: 'Error al eliminar item' }, { status: 500 });
    }

    // Also soft delete related variants, sizes, and add-ons
    await Promise.all([
      supabase
        .from('menu_item_variants')
        .update({ deleted_at: new Date().toISOString() })
        .eq('menu_item_id', item.id),
      supabase
        .from('menu_item_sizes')
        .update({ deleted_at: new Date().toISOString() })
        .eq('menu_item_id', item.id),
      supabase
        .from('menu_item_add_ons')
        .update({ deleted_at: new Date().toISOString() })
        .eq('menu_item_id', item.id),
    ]);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Delete menu item error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

// ======================
// PATCH - Quick Actions
// ======================
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await getUserAndVerify(request, params.id);
    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const { item, supabase, userRole } = result;

    // Check permissions
    if (!['owner', 'admin', 'manager', 'staff'].includes(userRole.role)) {
      return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 });
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
        return NextResponse.json({ success: false, error: 'Acción no válida' }, { status: 400 });
    }

    const { data: updatedItem, error: updateError } = await supabase
      .from('menu_items')
      .update(updateData)
      .eq('id', item.id)
      .select('id, name, is_available, is_featured')
      .single();

    if (updateError) {
      console.error('Error updating menu item:', updateError);
      return NextResponse.json({ success: false, error: 'Error al actualizar item' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: updatedItem,
    });

  } catch (error) {
    console.error('Patch menu item error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

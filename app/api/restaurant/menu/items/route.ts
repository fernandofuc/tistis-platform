// =====================================================
// TIS TIS PLATFORM - Restaurant Menu Items API
// GET: List items, POST: Create item
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
// GET - List Menu Items
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
    const categoryId = searchParams.get('category_id');
    const isAvailable = searchParams.get('is_available');
    const isFeatured = searchParams.get('is_featured');
    const isVegetarian = searchParams.get('is_vegetarian');
    const isVegan = searchParams.get('is_vegan');
    const isGlutenFree = searchParams.get('is_gluten_free');
    const minPrice = searchParams.get('min_price');
    const maxPrice = searchParams.get('max_price');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query
    let query = supabase
      .from('restaurant_menu_items')
      .select(`
        *,
        category:restaurant_menu_categories(id, name, parent_category_id)
      `, { count: 'exact' })
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('display_order', { ascending: true })
      .order('name', { ascending: true })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (branchId) {
      query = query.eq('branch_id', branchId);
    }
    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }
    if (isAvailable === 'true') {
      query = query.eq('is_available', true);
    } else if (isAvailable === 'false') {
      query = query.eq('is_available', false);
    }
    if (isFeatured === 'true') {
      query = query.eq('is_featured', true);
    }
    if (isVegetarian === 'true') {
      query = query.eq('is_vegetarian', true);
    }
    if (isVegan === 'true') {
      query = query.eq('is_vegan', true);
    }
    if (isGlutenFree === 'true') {
      query = query.eq('is_gluten_free', true);
    }
    if (minPrice) {
      query = query.gte('price', parseFloat(minPrice));
    }
    if (maxPrice) {
      query = query.lte('price', parseFloat(maxPrice));
    }
    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,sku.ilike.%${search}%`);
    }

    const { data: items, error: itemsError, count } = await query;

    if (itemsError) {
      console.error('Error fetching menu items:', itemsError);
      return NextResponse.json({ success: false, error: 'Error al cargar items del menú' }, { status: 500 });
    }

    // Get variants, sizes, and add-ons for each item
    const itemsWithExtras = await Promise.all(
      (items || []).map(async (item) => {
        const [variantsResult, sizesResult, addOnsResult] = await Promise.all([
          supabase
            .from('restaurant_menu_item_variants')
            .select('*')
            .eq('menu_item_id', item.id)
            .is('deleted_at', null)
            .order('display_order', { ascending: true }),
          supabase
            .from('restaurant_menu_item_sizes')
            .select('*')
            .eq('menu_item_id', item.id)
            .is('deleted_at', null)
            .order('display_order', { ascending: true }),
          supabase
            .from('restaurant_menu_item_add_ons')
            .select('*')
            .eq('menu_item_id', item.id)
            .is('deleted_at', null)
            .order('display_order', { ascending: true }),
        ]);

        return {
          ...item,
          variants: variantsResult.data || [],
          sizes: sizesResult.data || [],
          add_ons: addOnsResult.data || [],
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        items: itemsWithExtras,
        total: count || 0,
        limit,
        offset,
      },
    });

  } catch (error) {
    console.error('Menu items API error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

// ======================
// POST - Create Menu Item
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
      return NextResponse.json({ success: false, error: 'Sin permisos para crear items' }, { status: 403 });
    }

    const tenantId = userRole.tenant_id;

    // Parse body
    const body = await request.json();
    const {
      branch_id,
      category_id,
      name,
      description,
      price,
      cost,
      sku,
      image_url,
      preparation_time_minutes,
      calories,
      allergens = [],
      is_vegetarian = false,
      is_vegan = false,
      is_gluten_free = false,
      spice_level,
      is_available = true,
      is_featured = false,
      available_start_time,
      available_end_time,
      available_days,
      max_per_order,
      min_per_order = 1,
      display_order,
      // Related data
      variants = [],
      sizes = [],
      add_ons = [],
    } = body;

    // Validate required fields
    if (!branch_id || !category_id || !name || price === undefined) {
      return NextResponse.json({
        success: false,
        error: 'branch_id, category_id, name y price son requeridos',
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

    // Verify category belongs to tenant
    const { data: category } = await supabase
      .from('restaurant_menu_categories')
      .select('id')
      .eq('id', category_id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (!category) {
      return NextResponse.json({ success: false, error: 'Categoría no encontrada' }, { status: 404 });
    }

    // Get max display_order if not provided
    let finalDisplayOrder = display_order;
    if (finalDisplayOrder === undefined) {
      const { data: maxOrderResult } = await supabase
        .from('restaurant_menu_items')
        .select('display_order')
        .eq('category_id', category_id)
        .order('display_order', { ascending: false })
        .limit(1)
        .single();

      finalDisplayOrder = (maxOrderResult?.display_order || 0) + 1;
    }

    // Insert menu item
    const { data: newItem, error: insertError } = await supabase
      .from('restaurant_menu_items')
      .insert({
        tenant_id: tenantId,
        branch_id,
        category_id,
        name,
        description: description || null,
        price,
        cost: cost || null,
        sku: sku || null,
        image_url: image_url || null,
        preparation_time_minutes: preparation_time_minutes || null,
        calories: calories || null,
        allergens,
        is_vegetarian,
        is_vegan,
        is_gluten_free,
        spice_level: spice_level || null,
        is_available,
        is_featured,
        available_start_time: available_start_time || null,
        available_end_time: available_end_time || null,
        available_days: available_days || null,
        max_per_order: max_per_order || null,
        min_per_order,
        display_order: finalDisplayOrder,
      })
      .select(`
        *,
        category:restaurant_menu_categories(id, name)
      `)
      .single();

    if (insertError) {
      console.error('Error creating menu item:', insertError);
      return NextResponse.json({ success: false, error: 'Error al crear item del menú' }, { status: 500 });
    }

    // Insert variants if provided
    if (variants.length > 0) {
      const variantsToInsert = variants.map((v: any, index: number) => ({
        tenant_id: tenantId,
        menu_item_id: newItem.id,
        name: v.name,
        price_modifier: v.price_modifier || 0,
        is_default: v.is_default || false,
        is_available: v.is_available !== false,
        display_order: v.display_order || index,
      }));

      await supabase.from('restaurant_menu_item_variants').insert(variantsToInsert);
    }

    // Insert sizes if provided
    if (sizes.length > 0) {
      const sizesToInsert = sizes.map((s: any, index: number) => ({
        tenant_id: tenantId,
        menu_item_id: newItem.id,
        name: s.name,
        price: s.price,
        is_default: s.is_default || false,
        is_available: s.is_available !== false,
        display_order: s.display_order || index,
      }));

      await supabase.from('restaurant_menu_item_sizes').insert(sizesToInsert);
    }

    // Insert add-ons if provided
    if (add_ons.length > 0) {
      const addOnsToInsert = add_ons.map((a: any, index: number) => ({
        tenant_id: tenantId,
        menu_item_id: newItem.id,
        name: a.name,
        price: a.price || 0,
        is_available: a.is_available !== false,
        max_quantity: a.max_quantity || null,
        display_order: a.display_order || index,
      }));

      await supabase.from('restaurant_menu_item_add_ons').insert(addOnsToInsert);
    }

    // Fetch complete item with extras
    const [variantsResult, sizesResult, addOnsResult] = await Promise.all([
      supabase
        .from('restaurant_menu_item_variants')
        .select('*')
        .eq('menu_item_id', newItem.id)
        .is('deleted_at', null)
        .order('display_order', { ascending: true }),
      supabase
        .from('restaurant_menu_item_sizes')
        .select('*')
        .eq('menu_item_id', newItem.id)
        .is('deleted_at', null)
        .order('display_order', { ascending: true }),
      supabase
        .from('restaurant_menu_item_add_ons')
        .select('*')
        .eq('menu_item_id', newItem.id)
        .is('deleted_at', null)
        .order('display_order', { ascending: true }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        ...newItem,
        variants: variantsResult.data || [],
        sizes: sizesResult.data || [],
        add_ons: addOnsResult.data || [],
      },
    });

  } catch (error) {
    console.error('Create menu item error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

// ======================
// PUT - Bulk Update Items
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
      return NextResponse.json({ success: false, error: 'Sin permisos para actualizar items' }, { status: 403 });
    }

    const tenantId = userRole.tenant_id;

    // Parse body
    const body = await request.json();
    const { action, item_ids, data } = body;

    if (!action || !Array.isArray(item_ids) || item_ids.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'action e item_ids son requeridos',
      }, { status: 400 });
    }

    let updateData: Record<string, unknown> = {};

    switch (action) {
      case 'toggle_availability':
        updateData = { is_available: data?.is_available ?? true };
        break;
      case 'toggle_featured':
        updateData = { is_featured: data?.is_featured ?? false };
        break;
      case 'update_category':
        if (!data?.category_id) {
          return NextResponse.json({ success: false, error: 'category_id es requerido' }, { status: 400 });
        }
        updateData = { category_id: data.category_id };
        break;
      case 'update_price':
        if (data?.price === undefined) {
          return NextResponse.json({ success: false, error: 'price es requerido' }, { status: 400 });
        }
        updateData = { price: data.price };
        break;
      case 'reorder':
        // For reorder, we expect item_ids to be in order
        const reorderUpdates = await Promise.all(
          item_ids.map(async (id, index) => {
            const { error } = await supabase
              .from('restaurant_menu_items')
              .update({ display_order: index })
              .eq('id', id)
              .eq('tenant_id', tenantId);
            return { id, success: !error };
          })
        );
        return NextResponse.json({
          success: true,
          data: {
            updated: reorderUpdates.filter(u => u.success).length,
          },
        });
      default:
        return NextResponse.json({ success: false, error: 'Acción no válida' }, { status: 400 });
    }

    // Apply bulk update
    const { data: updatedItems, error: updateError } = await supabase
      .from('restaurant_menu_items')
      .update(updateData)
      .in('id', item_ids)
      .eq('tenant_id', tenantId)
      .select('id');

    if (updateError) {
      console.error('Error bulk updating items:', updateError);
      return NextResponse.json({ success: false, error: 'Error al actualizar items' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        updated: updatedItems?.length || 0,
      },
    });

  } catch (error) {
    console.error('Bulk update items error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

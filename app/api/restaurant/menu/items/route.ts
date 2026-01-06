// =====================================================
// TIS TIS PLATFORM - Restaurant Menu Items API
// GET: List items, POST: Create item
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
  canWrite
} from '@/src/lib/api/auth-helper';

// ======================
// GET - List Menu Items
// Schema columns: id, tenant_id, category_id, name, slug, description, short_description,
// price, price_lunch, price_happy_hour, currency, variants (JSONB), sizes (JSONB), add_ons (JSONB),
// calories, protein_g, carbs_g, fat_g, allergens (TEXT[]), is_vegetarian, is_vegan,
// is_gluten_free, is_spicy, spice_level, is_new, is_popular, prep_time_minutes,
// cooking_instructions, image_url, image_gallery (TEXT[]), is_available, available_quantity,
// out_of_stock_until, display_order, is_featured, times_ordered, average_rating, metadata
// NOTE: NO branch_id column, NO sku column, NO parent_category_id in category join
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

    // Build query with SCHEMA-CORRECT columns
    // Note: category.parent_id NOT parent_category_id
    let query = supabase
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
        is_popular,
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
      `, { count: 'exact' })
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('display_order', { ascending: true })
      .order('name', { ascending: true })
      .range(offset, offset + limit - 1);

    // Apply filters
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
      // No sku column in schema - only search name and description
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data: items, error: itemsError, count } = await query;

    if (itemsError) {
      console.error('Error fetching menu items:', JSON.stringify(itemsError));
      return errorResponse(`Error al cargar items del menú: ${itemsError.message}`, 500);
    }

    // variants, sizes, add_ons are already JSONB columns in the item - no extra queries needed!
    return successResponse({
      items: items || [],
      total: count || 0,
      limit,
      offset,
    });

  } catch (error: any) {
    console.error('Menu items API error:', error);
    return errorResponse(`Error interno: ${error?.message || 'Unknown'}`, 500);
  }
}

// ======================
// POST - Create Menu Item
// Schema: NO branch_id, NO sku, NO cost, NO min_per_order, NO max_per_order
// variants/sizes/add_ons are JSONB columns NOT separate tables
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
      return errorResponse('Sin permisos para crear items', 403);
    }

    const tenantId = userRole.tenant_id;

    // Parse body
    const body = await request.json();
    const {
      category_id,
      name,
      description,
      short_description,
      price,
      price_lunch,
      price_happy_hour,
      currency = 'MXN',
      image_url,
      image_gallery,
      prep_time_minutes,
      cooking_instructions,
      calories,
      protein_g,
      carbs_g,
      fat_g,
      allergens = [],
      is_vegetarian = false,
      is_vegan = false,
      is_gluten_free = false,
      is_spicy = false,
      spice_level,
      is_new = false,
      is_popular = false,
      is_house_special = false,
      is_chef_recommendation = false,
      is_available = true,
      available_quantity,
      is_featured = false,
      display_order,
      metadata,
      // JSONB columns - store directly
      variants = [],
      sizes = [],
      add_ons = [],
    } = body;

    // Validate required fields - NO branch_id required (schema doesn't have it)
    if (!category_id || !name || price === undefined) {
      return errorResponse('category_id, name y price son requeridos', 400);
    }

    // Verify category belongs to tenant
    const { data: category, error: catError } = await supabase
      .from('restaurant_menu_categories')
      .select('id')
      .eq('id', category_id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (catError || !category) {
      return errorResponse('Categoría no encontrada', 404);
    }

    // Generate slug from name
    const baseSlug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    // Make slug unique
    let slug = baseSlug;
    let slugCounter = 1;
    while (true) {
      const { data: existingSlug } = await supabase
        .from('restaurant_menu_items')
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
      const { data: maxOrderResult } = await supabase
        .from('restaurant_menu_items')
        .select('display_order')
        .eq('category_id', category_id)
        .order('display_order', { ascending: false })
        .limit(1)
        .maybeSingle();

      finalDisplayOrder = (maxOrderResult?.display_order || 0) + 1;
    }

    // Build insert data with SCHEMA-CORRECT columns
    const insertData: Record<string, any> = {
      tenant_id: tenantId,
      category_id,
      name,
      slug,
      price,
      currency,
      is_vegetarian,
      is_vegan,
      is_gluten_free,
      is_spicy,
      is_new,
      is_popular,
      is_house_special,
      is_chef_recommendation,
      is_available,
      is_featured,
      display_order: finalDisplayOrder,
      // JSONB columns stored directly
      variants: variants || [],
      sizes: sizes || [],
      add_ons: add_ons || [],
      allergens: allergens || [],
    };

    // Optional fields
    if (description) insertData.description = description;
    if (short_description) insertData.short_description = short_description;
    if (price_lunch !== undefined) insertData.price_lunch = price_lunch;
    if (price_happy_hour !== undefined) insertData.price_happy_hour = price_happy_hour;
    if (image_url) insertData.image_url = image_url;
    if (image_gallery) insertData.image_gallery = image_gallery;
    if (prep_time_minutes !== undefined) insertData.prep_time_minutes = prep_time_minutes;
    if (cooking_instructions) insertData.cooking_instructions = cooking_instructions;
    if (calories !== undefined) insertData.calories = calories;
    if (protein_g !== undefined) insertData.protein_g = protein_g;
    if (carbs_g !== undefined) insertData.carbs_g = carbs_g;
    if (fat_g !== undefined) insertData.fat_g = fat_g;
    if (spice_level !== undefined) insertData.spice_level = spice_level;
    if (available_quantity !== undefined) insertData.available_quantity = available_quantity;
    if (metadata) insertData.metadata = metadata;

    const { data: newItem, error: insertError } = await supabase
      .from('restaurant_menu_items')
      .insert(insertData)
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
        is_popular,
        is_house_special,
        is_chef_recommendation,
        prep_time_minutes,
        cooking_instructions,
        image_url,
        image_gallery,
        is_available,
        available_quantity,
        display_order,
        is_featured,
        metadata,
        created_at,
        updated_at,
        category:restaurant_menu_categories(id, name)
      `)
      .single();

    if (insertError) {
      console.error('Error creating menu item:', JSON.stringify(insertError));
      if (insertError.code === '23505') {
        return errorResponse('Ya existe un item con ese nombre/slug', 409);
      }
      if (insertError.code === '42P01') {
        return errorResponse('Tabla restaurant_menu_items no existe', 500);
      }
      return errorResponse(`Error al crear item del menú: ${insertError.message}`, 500);
    }

    return successResponse(newItem);

  } catch (error: any) {
    console.error('Create menu item error:', error);
    return errorResponse(`Error interno: ${error?.message || 'Unknown'}`, 500);
  }
}

// ======================
// PUT - Bulk Update Items
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
      return errorResponse('Sin permisos para actualizar items', 403);
    }

    const tenantId = userRole.tenant_id;

    // Parse body
    const body = await request.json();
    const { action, item_ids, data } = body;

    if (!action || !Array.isArray(item_ids) || item_ids.length === 0) {
      return errorResponse('action e item_ids son requeridos', 400);
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
          return errorResponse('category_id es requerido', 400);
        }
        updateData = { category_id: data.category_id };
        break;
      case 'update_price':
        if (data?.price === undefined) {
          return errorResponse('price es requerido', 400);
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
            return { id, success: !error, error: error?.message };
          })
        );
        return successResponse({
          updated: reorderUpdates.filter(u => u.success).length,
        });
      default:
        return errorResponse('Acción no válida', 400);
    }

    // Apply bulk update
    const { data: updatedItems, error: updateError } = await supabase
      .from('restaurant_menu_items')
      .update(updateData)
      .in('id', item_ids)
      .eq('tenant_id', tenantId)
      .select('id');

    if (updateError) {
      console.error('Error bulk updating items:', JSON.stringify(updateError));
      return errorResponse(`Error al actualizar items: ${updateError.message}`, 500);
    }

    return successResponse({
      updated: updatedItems?.length || 0,
    });

  } catch (error: any) {
    console.error('Bulk update items error:', error);
    return errorResponse(`Error interno: ${error?.message || 'Unknown'}`, 500);
  }
}

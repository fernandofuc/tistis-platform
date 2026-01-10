// =====================================================
// TIS TIS PLATFORM - Restaurant Menu Items API
// GET: List items, POST: Create item
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
  canWrite,
  isValidUUID,
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

// Max items for bulk operations
const MAX_BULK_ITEMS = 100;

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
// GET - List Menu Items
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

    // Sanitize pagination params
    const limit = sanitizeInteger(searchParams.get('limit'), 1, LIMITS.MAX_QUERY_LIMIT, 100);
    const offset = sanitizeInteger(searchParams.get('offset'), 0, 10000, 0);

    // Validate category_id if provided
    if (categoryId && !isValidUUID(categoryId)) {
      return errorResponse('category_id inválido', 400);
    }

    // Build query with SCHEMA-CORRECT columns
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

    // Validate and sanitize price filters
    if (minPrice) {
      const min = sanitizePrice(minPrice);
      if (min > 0) {
        query = query.gte('price', min);
      }
    }
    if (maxPrice) {
      const max = sanitizePrice(maxPrice);
      if (max > 0) {
        query = query.lte('price', max);
      }
    }

    // Sanitize search to prevent SQL injection in ilike
    if (search) {
      const sanitizedSearch = search.replace(/[%_\\]/g, '\\$&');
      query = query.or(`name.ilike.%${sanitizedSearch}%,description.ilike.%${sanitizedSearch}%`);
    }

    const { data: items, error: itemsError, count } = await query;

    if (itemsError) {
      console.error('Error fetching menu items:', JSON.stringify(itemsError));
      return errorResponse(`Error al cargar items del menú: ${itemsError.message}`, 500);
    }

    return successResponse({
      items: items || [],
      total: count || 0,
      limit,
      offset,
    });

  } catch (error) {
    console.error('Menu items API error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

// ======================
// POST - Create Menu Item
// ======================
export async function POST(request: NextRequest) {
  try {
    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { userRole, supabase } = auth;

    if (!canWrite(userRole.role)) {
      return errorResponse('Sin permisos para crear items', 403);
    }

    const tenantId = userRole.tenant_id;
    const body = await request.json();

    // Validate and sanitize required fields
    const name = sanitizeText(body.name, LIMITS.MAX_TEXT_MEDIUM);
    if (!name) {
      return errorResponse('name es requerido', 400);
    }

    if (!body.category_id || !isValidUUID(body.category_id)) {
      return errorResponse('category_id inválido o requerido', 400);
    }

    // Validate price
    const price = sanitizePrice(body.price);
    if (price <= 0) {
      return errorResponse('price debe ser mayor a 0', 400);
    }

    // Validate currency
    const currency = body.currency || 'MXN';
    if (!VALID_CURRENCIES.includes(currency)) {
      return errorResponse(`Moneda inválida. Permitidas: ${VALID_CURRENCIES.join(', ')}`, 400);
    }

    // Verify category belongs to tenant
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
      if (slugCounter > 100) break; // Prevent infinite loop
    }

    // Get max display_order if not provided
    let finalDisplayOrder = body.display_order;
    if (finalDisplayOrder === undefined) {
      const { data: maxOrderResult } = await supabase
        .from('restaurant_menu_items')
        .select('display_order')
        .eq('category_id', body.category_id)
        .order('display_order', { ascending: false })
        .limit(1)
        .maybeSingle();

      finalDisplayOrder = (maxOrderResult?.display_order || 0) + 1;
    }

    // Sanitize JSONB arrays
    let variants: Record<string, unknown>[] = [];
    if (Array.isArray(body.variants)) {
      variants = (body.variants as unknown[])
        .slice(0, 20)
        .map((v: unknown) => sanitizeVariant(v))
        .filter((v): v is Record<string, unknown> => v !== null);
    }

    let sizes: Record<string, unknown>[] = [];
    if (Array.isArray(body.sizes)) {
      sizes = (body.sizes as unknown[])
        .slice(0, 10)
        .map((s: unknown) => sanitizeSize(s))
        .filter((s): s is Record<string, unknown> => s !== null);
    }

    let addOns: Record<string, unknown>[] = [];
    if (Array.isArray(body.add_ons)) {
      addOns = (body.add_ons as unknown[])
        .slice(0, 30)
        .map((a: unknown) => sanitizeAddOnMenu(a))
        .filter((a): a is Record<string, unknown> => a !== null);
    }

    // Sanitize allergens array
    let allergens: string[] = [];
    if (Array.isArray(body.allergens)) {
      allergens = (body.allergens as unknown[])
        .slice(0, 20)
        .map((a: unknown) => sanitizeText(a, 50))
        .filter((a): a is string => a !== null);
    }

    // Sanitize image_gallery array
    let imageGallery: string[] = [];
    if (Array.isArray(body.image_gallery)) {
      imageGallery = (body.image_gallery as unknown[])
        .slice(0, 10)
        .map((url: unknown) => sanitizeText(url, 500))
        .filter((url): url is string => url !== null);
    }

    // Build insert data with sanitized fields
    const insertData: Record<string, unknown> = {
      tenant_id: tenantId,
      category_id: body.category_id,
      name,
      slug,
      price,
      currency,
      is_vegetarian: Boolean(body.is_vegetarian),
      is_vegan: Boolean(body.is_vegan),
      is_gluten_free: Boolean(body.is_gluten_free),
      is_spicy: Boolean(body.is_spicy),
      is_new: Boolean(body.is_new),
      is_house_special: Boolean(body.is_house_special),
      is_chef_recommendation: Boolean(body.is_chef_recommendation),
      is_available: body.is_available !== false,
      is_featured: Boolean(body.is_featured),
      display_order: finalDisplayOrder,
      variants,
      sizes,
      add_ons: addOns,
      allergens,
    };

    // Optional sanitized fields
    if (body.description) {
      insertData.description = sanitizeText(body.description, LIMITS.MAX_TEXT_XLARGE);
    }
    if (body.short_description) {
      insertData.short_description = sanitizeText(body.short_description, LIMITS.MAX_TEXT_MEDIUM);
    }
    if (body.price_lunch !== undefined) {
      insertData.price_lunch = sanitizePrice(body.price_lunch);
    }
    if (body.price_happy_hour !== undefined) {
      insertData.price_happy_hour = sanitizePrice(body.price_happy_hour);
    }
    if (body.image_url) {
      insertData.image_url = sanitizeText(body.image_url, 500);
    }
    if (imageGallery.length > 0) {
      insertData.image_gallery = imageGallery;
    }
    if (body.prep_time_minutes !== undefined) {
      insertData.prep_time_minutes = sanitizeInteger(body.prep_time_minutes, 0, 480, 0);
    }
    if (body.cooking_instructions) {
      insertData.cooking_instructions = sanitizeText(body.cooking_instructions, LIMITS.MAX_TEXT_XLARGE);
    }
    if (body.calories !== undefined) {
      insertData.calories = sanitizeInteger(body.calories, 0, 10000, 0);
    }
    if (body.protein_g !== undefined) {
      insertData.protein_g = sanitizeInteger(body.protein_g, 0, 1000, 0);
    }
    if (body.carbs_g !== undefined) {
      insertData.carbs_g = sanitizeInteger(body.carbs_g, 0, 1000, 0);
    }
    if (body.fat_g !== undefined) {
      insertData.fat_g = sanitizeInteger(body.fat_g, 0, 1000, 0);
    }
    if (body.spice_level !== undefined) {
      insertData.spice_level = sanitizeInteger(body.spice_level, 0, 5, 0);
    }
    if (body.available_quantity !== undefined) {
      insertData.available_quantity = sanitizeInteger(body.available_quantity, 0, 999999, 0);
    }

    const { data: newItem, error: insertError } = await supabase
      .from('restaurant_menu_items')
      .insert(insertData)
      .select(`
        *,
        category:restaurant_menu_categories(id, name)
      `)
      .single();

    if (insertError) {
      console.error('Error creating menu item:', JSON.stringify(insertError));
      if (insertError.code === '23505') {
        return errorResponse('Ya existe un item con ese nombre/slug', 409);
      }
      return errorResponse(`Error al crear item del menú: ${insertError.message}`, 500);
    }

    return successResponse(newItem, 201);

  } catch (error) {
    console.error('Create menu item error:', error);
    return errorResponse('Error interno del servidor', 500);
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

    if (!canWrite(userRole.role)) {
      return errorResponse('Sin permisos para actualizar items', 403);
    }

    const tenantId = userRole.tenant_id;
    const body = await request.json();
    const { action, item_ids, data } = body;

    // Valid actions
    const validActions = ['toggle_availability', 'toggle_featured', 'update_category', 'update_price', 'reorder'];

    if (!action || !validActions.includes(action)) {
      return errorResponse(`action inválida. Permitidas: ${validActions.join(', ')}`, 400);
    }

    if (!Array.isArray(item_ids) || item_ids.length === 0) {
      return errorResponse('item_ids es requerido y debe ser un array', 400);
    }

    // Limit bulk operations
    if (item_ids.length > MAX_BULK_ITEMS) {
      return errorResponse(`Máximo ${MAX_BULK_ITEMS} items por operación`, 400);
    }

    // Validate all UUIDs
    const validItemIds = item_ids.filter((id): id is string =>
      typeof id === 'string' && isValidUUID(id)
    );

    if (validItemIds.length === 0) {
      return errorResponse('No se encontraron IDs válidos', 400);
    }

    let updateData: Record<string, unknown> = {};

    switch (action) {
      case 'toggle_availability':
        updateData = { is_available: Boolean(data?.is_available) };
        break;

      case 'toggle_featured':
        updateData = { is_featured: Boolean(data?.is_featured) };
        break;

      case 'update_category':
        if (!data?.category_id || !isValidUUID(data.category_id)) {
          return errorResponse('category_id inválido', 400);
        }
        // Verify category belongs to tenant
        const { data: cat } = await supabase
          .from('restaurant_menu_categories')
          .select('id')
          .eq('id', data.category_id)
          .eq('tenant_id', tenantId)
          .is('deleted_at', null)
          .single();
        if (!cat) {
          return errorResponse('Categoría no encontrada', 404);
        }
        updateData = { category_id: data.category_id };
        break;

      case 'update_price':
        const newPrice = sanitizePrice(data?.price);
        if (newPrice <= 0) {
          return errorResponse('price debe ser mayor a 0', 400);
        }
        updateData = { price: newPrice };
        break;

      case 'reorder':
        // For reorder, update each item's display_order
        const reorderUpdates = await Promise.all(
          validItemIds.map(async (id, index) => {
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
    }

    // Apply bulk update
    const { data: updatedItems, error: updateError } = await supabase
      .from('restaurant_menu_items')
      .update(updateData)
      .in('id', validItemIds)
      .eq('tenant_id', tenantId)
      .select('id');

    if (updateError) {
      console.error('Error bulk updating items:', JSON.stringify(updateError));
      return errorResponse(`Error al actualizar items: ${updateError.message}`, 500);
    }

    return successResponse({
      updated: updatedItems?.length || 0,
    });

  } catch (error) {
    console.error('Bulk update items error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

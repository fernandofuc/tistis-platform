// =====================================================
// TIS TIS PLATFORM - Restaurant Inventory Items API
// GET: List items, POST: Create item
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import {
  getUserAndTenant,
  isAuthError,
  errorResponse,
  successResponse,
  isValidUUID,
  canWrite,
} from '@/src/lib/api/auth-helper';
import { sanitizeText, sanitizePrice, sanitizeInteger, LIMITS } from '@/src/lib/api/sanitization-helper';

// Valid item types
const VALID_ITEM_TYPES = ['ingredient', 'product', 'supply', 'packaging'];
const VALID_STORAGE_TYPES = ['dry', 'refrigerated', 'frozen', 'room_temp'];

// ======================
// GET - List Items
// ======================
export async function GET(request: NextRequest) {
  try {
    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { userRole, supabase } = auth;
    const { searchParams } = new URL(request.url);

    const branchId = searchParams.get('branch_id');
    const categoryId = searchParams.get('category_id');
    const search = searchParams.get('search');
    const lowStockOnly = searchParams.get('low_stock_only') === 'true';
    const limit = sanitizeInteger(searchParams.get('limit'), 1, LIMITS.MAX_QUERY_LIMIT, 100);

    if (!branchId || !isValidUUID(branchId)) {
      return errorResponse('branch_id requerido', 400);
    }

    // Use separate queries for branch-specific and global items
    // PostgREST's .or() doesn't combine well with other AND conditions
    let branchQuery = supabase
      .from('inventory_items')
      .select('*')
      .eq('tenant_id', userRole.tenant_id)
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name', { ascending: true })
      .limit(limit);

    let globalQuery = supabase
      .from('inventory_items')
      .select('*')
      .eq('tenant_id', userRole.tenant_id)
      .is('branch_id', null)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name', { ascending: true })
      .limit(limit);

    if (categoryId && isValidUUID(categoryId)) {
      branchQuery = branchQuery.eq('category_id', categoryId);
      globalQuery = globalQuery.eq('category_id', categoryId);
    }

    if (search) {
      // Sanitize search to prevent issues with special characters
      const sanitizedSearch = search.replace(/[%_\\]/g, '\\$&');
      branchQuery = branchQuery.or(`name.ilike.%${sanitizedSearch}%,sku.ilike.%${sanitizedSearch}%`);
      globalQuery = globalQuery.or(`name.ilike.%${sanitizedSearch}%,sku.ilike.%${sanitizedSearch}%`);
    }

    const [branchResult, globalResult] = await Promise.all([branchQuery, globalQuery]);

    const error = branchResult.error || globalResult.error;
    // Combine results, branch items take priority over global
    const items = [...(branchResult.data || []), ...(globalResult.data || [])];

    if (error) {
      console.error('[Items API] Error fetching:', JSON.stringify(error, null, 2));
      // Handle table not exists error
      if (error.code === '42P01') {
        return errorResponse('Sistema de inventario no configurado - ejecute las migraciones', 500);
      }
      return errorResponse(`Error al obtener items: ${error.message || error.code || 'Unknown'}`, 500);
    }

    // Filter low stock items manually
    let filteredItems = items || [];
    if (lowStockOnly) {
      filteredItems = filteredItems.filter(item => {
        const stock = item.current_stock ?? 0;
        const minStock = item.minimum_stock ?? 0;
        return stock <= minStock;
      });
    }

    return successResponse(filteredItems);

  } catch (error) {
    console.error('[Items API] Unexpected error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

// ======================
// POST - Create Item
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

    const body = await request.json();

    // Validate and sanitize required fields
    const name = sanitizeText(body.name, LIMITS.MAX_TEXT_MEDIUM);
    if (!name) {
      return errorResponse('Nombre es requerido', 400);
    }

    const unit = sanitizeText(body.unit, 20);
    if (!unit) {
      return errorResponse('Unidad es requerida', 400);
    }

    // Validate optional UUID fields
    if (body.branch_id && !isValidUUID(body.branch_id)) {
      return errorResponse('branch_id inválido', 400);
    }

    if (body.category_id && !isValidUUID(body.category_id)) {
      return errorResponse('category_id inválido', 400);
    }

    if (body.preferred_supplier_id && !isValidUUID(body.preferred_supplier_id)) {
      return errorResponse('preferred_supplier_id inválido', 400);
    }

    // Validate enum fields
    const itemType = body.item_type || 'ingredient';
    if (!VALID_ITEM_TYPES.includes(itemType)) {
      return errorResponse(`Tipo de item inválido. Permitidos: ${VALID_ITEM_TYPES.join(', ')}`, 400);
    }

    const storageType = body.storage_type || 'dry';
    if (!VALID_STORAGE_TYPES.includes(storageType)) {
      return errorResponse(`Tipo de almacenamiento inválido. Permitidos: ${VALID_STORAGE_TYPES.join(', ')}`, 400);
    }

    // Sanitize allergens array
    let allergens: string[] = [];
    if (Array.isArray(body.allergens)) {
      allergens = body.allergens
        .slice(0, 20)
        .map((a: unknown) => sanitizeText(a, 50))
        .filter((a: string | null): a is string => a !== null);
    }

    const { data: item, error } = await supabase
      .from('inventory_items')
      .insert({
        tenant_id: userRole.tenant_id,
        branch_id: body.branch_id || null,
        name,
        sku: sanitizeText(body.sku, 50),
        description: sanitizeText(body.description, LIMITS.MAX_TEXT_XLARGE),
        category_id: body.category_id || null,
        item_type: itemType,
        unit,
        unit_cost: sanitizePrice(body.unit_cost),
        minimum_stock: sanitizeInteger(body.minimum_stock, 0, 999999, 0),
        maximum_stock: body.maximum_stock !== undefined ? sanitizeInteger(body.maximum_stock, 0, 999999, 0) : null,
        reorder_quantity: body.reorder_quantity !== undefined ? sanitizeInteger(body.reorder_quantity, 0, 99999, 0) : null,
        storage_location: sanitizeText(body.storage_location, 100),
        storage_type: storageType,
        is_perishable: body.is_perishable !== false,
        default_shelf_life_days: body.default_shelf_life_days !== undefined
          ? sanitizeInteger(body.default_shelf_life_days, 0, 3650, 0)
          : null,
        track_expiration: body.track_expiration !== false,
        preferred_supplier_id: body.preferred_supplier_id || null,
        image_url: sanitizeText(body.image_url, 500),
        allergens,
        is_active: body.is_active !== false,
        current_stock: 0,
      })
      .select(`
        *,
        category:inventory_categories(id, name, color)
      `)
      .single();

    if (error) {
      console.error('Error creating inventory item:', error);
      return errorResponse('Error al crear item', 500);
    }

    return successResponse(item, 201);

  } catch (error) {
    console.error('Create inventory item error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

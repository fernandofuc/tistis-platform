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
    const limit = parseInt(searchParams.get('limit') || '100');

    if (!branchId || !isValidUUID(branchId)) {
      return errorResponse('branch_id requerido', 400);
    }

    // Simple query without complex joins that might fail
    let query = supabase
      .from('inventory_items')
      .select('*')
      .eq('tenant_id', userRole.tenant_id)
      .or(`branch_id.eq.${branchId},branch_id.is.null`)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name', { ascending: true })
      .limit(limit);

    if (categoryId && isValidUUID(categoryId)) {
      query = query.eq('category_id', categoryId);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
    }

    const { data: items, error } = await query;

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
      filteredItems = filteredItems.filter(item => item.current_stock <= item.minimum_stock);
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
    const {
      branch_id,
      name,
      sku,
      description,
      category_id,
      item_type,
      unit,
      unit_cost,
      minimum_stock,
      maximum_stock,
      reorder_quantity,
      storage_location,
      storage_type,
      is_perishable,
      default_shelf_life_days,
      track_expiration,
      preferred_supplier_id,
      image_url,
      allergens,
      is_active,
    } = body;

    if (!name || !unit) {
      return errorResponse('Nombre y unidad son requeridos', 400);
    }

    const { data: item, error } = await supabase
      .from('inventory_items')
      .insert({
        tenant_id: userRole.tenant_id,
        branch_id,
        name,
        sku,
        description,
        category_id,
        item_type: item_type || 'ingredient',
        unit,
        unit_cost: unit_cost || 0,
        minimum_stock: minimum_stock || 0,
        maximum_stock,
        reorder_quantity,
        storage_location,
        storage_type: storage_type || 'dry',
        is_perishable: is_perishable !== false,
        default_shelf_life_days,
        track_expiration: track_expiration !== false,
        preferred_supplier_id,
        image_url,
        allergens: allergens || [],
        is_active: is_active !== false,
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

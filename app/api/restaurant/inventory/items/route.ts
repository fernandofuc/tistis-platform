// =====================================================
// TIS TIS PLATFORM - Restaurant Inventory Items API
// GET: List items, POST: Create item
// =====================================================

export const dynamic = 'force-dynamic';

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
// GET - List Items
// ======================
export async function GET(request: NextRequest) {
  try {
    const result = await getUserAndTenant(request);
    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const { userRole, supabase } = result;
    const { searchParams } = new URL(request.url);

    const branchId = searchParams.get('branch_id');
    const categoryId = searchParams.get('category_id');
    const search = searchParams.get('search');
    const itemType = searchParams.get('item_type');
    const lowStockOnly = searchParams.get('low_stock_only') === 'true';
    const limit = parseInt(searchParams.get('limit') || '100');

    if (!branchId) {
      return NextResponse.json({ success: false, error: 'branch_id requerido' }, { status: 400 });
    }

    let query = supabase
      .from('inventory_items')
      .select(`
        *,
        category:inventory_categories(id, name, color)
      `)
      .eq('tenant_id', userRole.tenant_id)
      .or(`branch_id.eq.${branchId},branch_id.is.null`)
      .is('deleted_at', null)
      .order('name', { ascending: true })
      .limit(limit);

    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
    }

    if (itemType) {
      query = query.eq('item_type', itemType);
    }

    const { data: items, error } = await query;

    if (error) {
      console.error('Error fetching inventory items:', error);
      return NextResponse.json({ success: false, error: 'Error al obtener items' }, { status: 500 });
    }

    // Filter low stock items manually
    let filteredItems = items;
    if (lowStockOnly) {
      filteredItems = items?.filter(item => item.current_stock <= item.minimum_stock) || [];
    }

    return NextResponse.json({ success: true, data: filteredItems });

  } catch (error) {
    console.error('Get inventory items error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

// ======================
// POST - Create Item
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
      return NextResponse.json({ success: false, error: 'Nombre y unidad son requeridos' }, { status: 400 });
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
      return NextResponse.json({ success: false, error: 'Error al crear item' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: item }, { status: 201 });

  } catch (error) {
    console.error('Create inventory item error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

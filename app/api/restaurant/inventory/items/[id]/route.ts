// =====================================================
// TIS TIS PLATFORM - Inventory Item Detail API
// GET: Get item, PUT: Update, DELETE: Soft delete
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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

function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// ======================
// GET - Get Item
// ======================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isValidUUID(id)) {
      return NextResponse.json({ success: false, error: 'ID de item inválido' }, { status: 400 });
    }

    const result = await getUserAndTenant(request);
    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const { userRole, supabase } = result;

    const { data: item, error } = await supabase
      .from('inventory_items')
      .select(`
        *,
        category:inventory_categories(id, name, color),
        supplier:inventory_suppliers(id, name, contact_name, phone)
      `)
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id)
      .is('deleted_at', null)
      .single();

    if (error || !item) {
      return NextResponse.json({ success: false, error: 'Item no encontrado' }, { status: 404 });
    }

    // Get active batches for this item
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branch_id');

    if (branchId) {
      const { data: batches } = await supabase
        .from('inventory_batches')
        .select('*')
        .eq('item_id', id)
        .eq('branch_id', branchId)
        .in('status', ['available', 'reserved'])
        .gt('current_quantity', 0)
        .order('expiration_date', { ascending: true, nullsFirst: false });

      return NextResponse.json({
        success: true,
        data: { ...item, batches: batches || [] }
      });
    }

    return NextResponse.json({ success: true, data: item });

  } catch (error) {
    console.error('Get item error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

// ======================
// PUT - Update Item
// ======================
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isValidUUID(id)) {
      return NextResponse.json({ success: false, error: 'ID de item inválido' }, { status: 400 });
    }

    const result = await getUserAndTenant(request);
    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const { userRole, supabase } = result;

    if (!['owner', 'admin', 'manager'].includes(userRole.role)) {
      return NextResponse.json({ success: false, error: 'Sin permisos para actualizar items' }, { status: 403 });
    }

    const body = await request.json();

    // Don't allow updating tenant_id or current_stock directly
    delete body.tenant_id;
    delete body.id;
    delete body.current_stock; // Stock must be updated via movements

    const { data: item, error } = await supabase
      .from('inventory_items')
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id)
      .is('deleted_at', null)
      .select(`
        *,
        category:inventory_categories(id, name, color),
        supplier:inventory_suppliers(id, name)
      `)
      .single();

    if (error || !item) {
      console.error('Error updating item:', error);
      return NextResponse.json({ success: false, error: 'Error al actualizar item' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: item });

  } catch (error) {
    console.error('Update item error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

// ======================
// DELETE - Soft Delete Item
// ======================
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isValidUUID(id)) {
      return NextResponse.json({ success: false, error: 'ID de item inválido' }, { status: 400 });
    }

    const result = await getUserAndTenant(request);
    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const { userRole, supabase } = result;

    if (!['owner', 'admin'].includes(userRole.role)) {
      return NextResponse.json({ success: false, error: 'Sin permisos para eliminar items' }, { status: 403 });
    }

    // Check if item is used in recipes
    const { count: recipeCount } = await supabase
      .from('recipe_ingredients')
      .select('id', { count: 'exact', head: true })
      .eq('inventory_item_id', id);

    if (recipeCount && recipeCount > 0) {
      return NextResponse.json({
        success: false,
        error: `No se puede eliminar: este item se usa en ${recipeCount} recetas`
      }, { status: 400 });
    }

    const { error } = await supabase
      .from('inventory_items')
      .update({
        deleted_at: new Date().toISOString(),
        is_active: false,
      })
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id);

    if (error) {
      console.error('Error deleting item:', error);
      return NextResponse.json({ success: false, error: 'Error al eliminar item' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Item eliminado' });

  } catch (error) {
    console.error('Delete item error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

// =====================================================
// TIS TIS PLATFORM - Inventory Category Detail API
// GET: Get category, PUT: Update, DELETE: Soft delete
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
// GET - Get Category
// ======================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isValidUUID(id)) {
      return NextResponse.json({ success: false, error: 'ID de categoría inválido' }, { status: 400 });
    }

    const result = await getUserAndTenant(request);
    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const { userRole, supabase } = result;

    const { data: category, error } = await supabase
      .from('inventory_categories')
      .select(`
        *,
        items:inventory_items(id, name, sku, current_stock, minimum_stock, unit, is_active)
      `)
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id)
      .is('deleted_at', null)
      .single();

    if (error || !category) {
      return NextResponse.json({ success: false, error: 'Categoría no encontrada' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: category });

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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isValidUUID(id)) {
      return NextResponse.json({ success: false, error: 'ID de categoría inválido' }, { status: 400 });
    }

    const result = await getUserAndTenant(request);
    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const { userRole, supabase } = result;

    if (!['owner', 'admin', 'manager'].includes(userRole.role)) {
      return NextResponse.json({ success: false, error: 'Sin permisos para actualizar categorías' }, { status: 403 });
    }

    const body = await request.json();

    // Don't allow updating tenant_id
    delete body.tenant_id;
    delete body.id;

    const { data: category, error } = await supabase
      .from('inventory_categories')
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error || !category) {
      console.error('Error updating category:', error);
      return NextResponse.json({ success: false, error: 'Error al actualizar categoría' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: category });

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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isValidUUID(id)) {
      return NextResponse.json({ success: false, error: 'ID de categoría inválido' }, { status: 400 });
    }

    const result = await getUserAndTenant(request);
    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const { userRole, supabase } = result;

    if (!['owner', 'admin'].includes(userRole.role)) {
      return NextResponse.json({ success: false, error: 'Sin permisos para eliminar categorías' }, { status: 403 });
    }

    // Check if category has items
    const { count } = await supabase
      .from('inventory_items')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', id)
      .is('deleted_at', null);

    if (count && count > 0) {
      return NextResponse.json({
        success: false,
        error: `No se puede eliminar: hay ${count} items en esta categoría`
      }, { status: 400 });
    }

    const { error } = await supabase
      .from('inventory_categories')
      .update({
        deleted_at: new Date().toISOString(),
        is_active: false,
      })
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id);

    if (error) {
      console.error('Error deleting category:', error);
      return NextResponse.json({ success: false, error: 'Error al eliminar categoría' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Categoría eliminada' });

  } catch (error) {
    console.error('Delete category error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

// =====================================================
// TIS TIS PLATFORM - Inventory Supplier Detail API
// GET: Get supplier, PUT: Update, DELETE: Soft delete
// =====================================================

export const dynamic = 'force-dynamic';

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
// GET - Get Supplier
// ======================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isValidUUID(id)) {
      return NextResponse.json({ success: false, error: 'ID de proveedor inválido' }, { status: 400 });
    }

    const result = await getUserAndTenant(request);
    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const { userRole, supabase } = result;

    const { data: supplier, error } = await supabase
      .from('inventory_suppliers')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id)
      .is('deleted_at', null)
      .single();

    if (error || !supplier) {
      return NextResponse.json({ success: false, error: 'Proveedor no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: supplier });

  } catch (error) {
    console.error('Get supplier error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

// ======================
// PUT - Update Supplier
// ======================
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isValidUUID(id)) {
      return NextResponse.json({ success: false, error: 'ID de proveedor inválido' }, { status: 400 });
    }

    const result = await getUserAndTenant(request);
    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const { userRole, supabase } = result;

    if (!['owner', 'admin', 'manager'].includes(userRole.role)) {
      return NextResponse.json({ success: false, error: 'Sin permisos para actualizar proveedores' }, { status: 403 });
    }

    const body = await request.json();

    const { data: supplier, error } = await supabase
      .from('inventory_suppliers')
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error || !supplier) {
      console.error('Error updating supplier:', error);
      return NextResponse.json({ success: false, error: 'Error al actualizar proveedor' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: supplier });

  } catch (error) {
    console.error('Update supplier error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

// ======================
// DELETE - Soft Delete Supplier
// ======================
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isValidUUID(id)) {
      return NextResponse.json({ success: false, error: 'ID de proveedor inválido' }, { status: 400 });
    }

    const result = await getUserAndTenant(request);
    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const { userRole, supabase } = result;

    if (!['owner', 'admin'].includes(userRole.role)) {
      return NextResponse.json({ success: false, error: 'Sin permisos para eliminar proveedores' }, { status: 403 });
    }

    const { error } = await supabase
      .from('inventory_suppliers')
      .update({
        deleted_at: new Date().toISOString(),
        is_active: false,
      })
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id);

    if (error) {
      console.error('Error deleting supplier:', error);
      return NextResponse.json({ success: false, error: 'Error al eliminar proveedor' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Proveedor eliminado' });

  } catch (error) {
    console.error('Delete supplier error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

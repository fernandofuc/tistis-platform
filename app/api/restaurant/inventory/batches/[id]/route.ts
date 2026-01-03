// =====================================================
// TIS TIS PLATFORM - Inventory Batch Detail API
// GET: Get batch, PUT: Update batch status
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
// GET - Get Batch
// ======================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isValidUUID(id)) {
      return NextResponse.json({ success: false, error: 'ID de lote inválido' }, { status: 400 });
    }

    const result = await getUserAndTenant(request);
    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const { userRole, supabase } = result;

    const { data: batch, error } = await supabase
      .from('inventory_batches')
      .select(`
        *,
        item:inventory_items(id, name, sku, unit, category_id),
        supplier:inventory_suppliers(id, name, contact_name, phone)
      `)
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id)
      .single();

    if (error || !batch) {
      return NextResponse.json({ success: false, error: 'Lote no encontrado' }, { status: 404 });
    }

    // Get movements for this batch
    const { data: movements } = await supabase
      .from('inventory_movements')
      .select('*')
      .eq('batch_id', id)
      .order('performed_at', { ascending: false });

    return NextResponse.json({
      success: true,
      data: { ...batch, movements: movements || [] }
    });

  } catch (error) {
    console.error('Get batch error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

// ======================
// PUT - Update Batch
// ======================
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isValidUUID(id)) {
      return NextResponse.json({ success: false, error: 'ID de lote inválido' }, { status: 400 });
    }

    const result = await getUserAndTenant(request);
    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const { userRole, supabase } = result;

    if (!['owner', 'admin', 'manager'].includes(userRole.role)) {
      return NextResponse.json({ success: false, error: 'Sin permisos para actualizar lotes' }, { status: 403 });
    }

    const body = await request.json();
    const allowedFields = ['status', 'expiration_date', 'notes', 'batch_number', 'lot_number'];

    const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
    allowedFields.forEach(field => {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    });

    const { data: batch, error } = await supabase
      .from('inventory_batches')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id)
      .select(`
        *,
        item:inventory_items(id, name, sku, unit),
        supplier:inventory_suppliers(id, name)
      `)
      .single();

    if (error || !batch) {
      console.error('Error updating batch:', error);
      return NextResponse.json({ success: false, error: 'Error al actualizar lote' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: batch });

  } catch (error) {
    console.error('Update batch error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

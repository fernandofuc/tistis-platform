// =====================================================
// TIS TIS PLATFORM - Inventory Batches API
// GET: List batches, POST: Create batch (receive stock)
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

// ======================
// GET - List Batches
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
    const itemId = searchParams.get('item_id');
    const status = searchParams.get('status');
    const expiringDays = searchParams.get('expiring_days');

    if (!branchId) {
      return NextResponse.json({ success: false, error: 'branch_id requerido' }, { status: 400 });
    }

    let query = supabase
      .from('inventory_batches')
      .select(`
        *,
        item:inventory_items(id, name, sku, unit),
        supplier:inventory_suppliers(id, name)
      `)
      .eq('tenant_id', userRole.tenant_id)
      .eq('branch_id', branchId)
      .order('received_at', { ascending: false });

    if (itemId) {
      query = query.eq('item_id', itemId);
    }

    if (status) {
      query = query.eq('status', status);
    } else {
      query = query.in('status', ['available', 'reserved']);
    }

    if (expiringDays) {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + parseInt(expiringDays));
      query = query
        .not('expiration_date', 'is', null)
        .lte('expiration_date', futureDate.toISOString());
    }

    const { data: batches, error } = await query;

    if (error) {
      console.error('Error fetching batches:', error);
      return NextResponse.json({ success: false, error: 'Error al obtener lotes' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: batches });

  } catch (error) {
    console.error('Get batches error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

// ======================
// POST - Create Batch (Receive Stock)
// ======================
export async function POST(request: NextRequest) {
  try {
    const result = await getUserAndTenant(request);
    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const { user, userRole, supabase } = result;

    if (!['owner', 'admin', 'manager'].includes(userRole.role)) {
      return NextResponse.json({ success: false, error: 'Sin permisos para recibir stock' }, { status: 403 });
    }

    const body = await request.json();
    const {
      branch_id,
      item_id,
      batch_number,
      lot_number,
      initial_quantity,
      unit_cost,
      expiration_date,
      manufactured_date,
      supplier_id,
      invoice_number,
      notes,
    } = body;

    if (!branch_id || !item_id || !initial_quantity || !unit_cost) {
      return NextResponse.json({
        success: false,
        error: 'branch_id, item_id, initial_quantity y unit_cost son requeridos'
      }, { status: 400 });
    }

    // Get item info to create movement
    const { data: item } = await supabase
      .from('inventory_items')
      .select('current_stock, unit')
      .eq('id', item_id)
      .single();

    const totalCost = initial_quantity * unit_cost;
    const previousStock = item?.current_stock || 0;

    // Create batch
    const { data: batch, error: batchError } = await supabase
      .from('inventory_batches')
      .insert({
        tenant_id: userRole.tenant_id,
        branch_id,
        item_id,
        batch_number,
        lot_number,
        initial_quantity,
        current_quantity: initial_quantity,
        unit_cost,
        total_cost: totalCost,
        expiration_date,
        manufactured_date,
        supplier_id,
        invoice_number,
        notes,
        status: 'available',
      })
      .select(`
        *,
        item:inventory_items(id, name, sku, unit),
        supplier:inventory_suppliers(id, name)
      `)
      .single();

    if (batchError) {
      console.error('Error creating batch:', batchError);
      return NextResponse.json({ success: false, error: 'Error al crear lote' }, { status: 500 });
    }

    // Create inventory movement (this triggers stock update)
    const { error: movementError } = await supabase
      .from('inventory_movements')
      .insert({
        tenant_id: userRole.tenant_id,
        branch_id,
        item_id,
        batch_id: batch.id,
        movement_type: 'purchase',
        quantity: initial_quantity,
        previous_stock: previousStock,
        new_stock: previousStock + initial_quantity,
        unit_cost,
        total_cost: totalCost,
        reference_type: 'batch',
        reference_id: batch.id,
        performed_by: user.id,
        reason: `Recepción de lote ${batch_number || batch.id.slice(0, 8)}`,
      });

    if (movementError) {
      console.error('Error creating movement:', movementError);
      // Note: batch was created, movement failed - log but continue
    }

    return NextResponse.json({ success: true, data: batch }, { status: 201 });

  } catch (error) {
    console.error('Create batch error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}
